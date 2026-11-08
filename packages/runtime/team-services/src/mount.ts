/**
 * Alpha.5 P2 — the ONE mount entry point for a Member's compiled a5sf realm.
 *
 * WHY A SEPARATE ENTRY POINT: at the base of this package the two installers
 * (`installMemberIoProviders`, `installToolBindingRealm`) had NO production
 * caller — only the barrel re-export, the P1-05 suite and the R2 harness — so
 * the compiled realm was provable in-process and INERT in a Host. A P2 live
 * run's central facts ("the tool read through the Member's Provider", "the
 * guard was consulted") could therefore only be driver self-reports. This
 * module is the named seam a booted Host would call, in one place, for one
 * admitted Member: it mounts the Member ceiling realm and each admitted
 * tool-binding realm, and — when the caller supplies an observer — makes every
 * guard consultation observable and transportable (`guard-observability.ts`).
 *
 * WHAT THIS IS NOT: not a second launcher (the caller owns the root Context),
 * not a policy compiler (it consumes the SAME `CompileResult<MemberPolicy>` /
 * `EffectiveIoPolicy` objects P1-02 produced; it never re-evaluates a lane),
 * not a budget ledger, not an oracle, and not a decision. It composes the two
 * existing installers and adds rollback across them.
 *
 * ATOMICITY: if a binding realm fails to mount after the Member realm(s)
 * mounted, every binding mounted so far and the Member installation are
 * disposed before the typed install error propagates. `dispose()` is
 * idempotent and disposes bindings before Member ceilings.
 *
 * COVERAGE, NOT JUST NAMES: a module may register from a DEFERRED
 * `ctx.inject(...)` child after `apply` returns (the pinned `dsh-tool-fs`
 * registers `read_image` that way). A mount therefore SETTLES a bounded window,
 * lets the child run THROUGH THE SAME ROUTER (its deferred inject carries the
 * router's two services, see `routedModuleContext`), and then INSPECTS the
 * result: a FAILED child, a child that never settles, or a name no fiber of the
 * attach forwards is refused (typed `SERVICE_MOUNT_FAILED`) — while a child that
 * forwards a covered name is accepted, identity-tracked and verified exactly
 * like a synchronous registration. An optional dependency absent everywhere
 * stays benign (the child never runs and registers nothing). Refusing disposes
 * every fiber this mount created, so the preset surface is restored.
 *
 * @module @dsh-agent-team/runtime/team-services/mount
 */

import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis'
import type {
  CompileResult,
  EffectiveIoPolicy,
  MemberPolicy,
  TrustedMemberIdentity,
} from '../../member-io-policy/src/types.js'
import type { FsProviderConstructor } from './fs.js'
import type { GuardConsultObserver } from './guard-observability.js'
import {
  installMemberIoProviders,
  installToolBindingRealm,
  type MemberServiceSpec,
  type ToolBindingRealm,
  type ToolBindingRealmSpec,
} from './install.js'
import type { ConfinedSubprocessRealmSpec, ConfinedTerminalRealmSpec, ConfinedWebRealmSpec } from './install.js'
import type { MemberIoInstallation } from './types.js'
import { TeamServiceInstallError } from './types.js'

/** One Member to mount: identity + the ceiling compiled for that generation. */
export interface A5sfRealmMember {
  readonly identity: TrustedMemberIdentity
  readonly policy: CompileResult<MemberPolicy>
  readonly config?: Record<string, unknown>
}

/** One admitted (Member × tool binding) realm to mount under the ceiling. */
export interface A5sfRealmBinding {
  readonly identity: TrustedMemberIdentity
  readonly toolBindingIdentity: string
  readonly effective: EffectiveIoPolicy
  readonly config?: Record<string, unknown>
}

/**
 * One NATIVE tool module to re-mount INSIDE the Member's isolated `fs` scope.
 *
 * WHY THIS EXISTS (route C, 2026-11-03): the Agent preset registry mounts its
 * tool rows under the preset's STANDING scope, which is an ANCESTOR of the
 * agent scope; the definition a preset registers therefore resolves the preset
 * scope's `fs` (the base Provider). A registration made from the Member's own
 * isolated scope — `root.isolate('fs', label)`, whose DSH scope key is still the
 * agent's (`cordinate extend` inherits the scope tag) — SHADOWS that definition
 * for this agent only, and its body resolves the confined Provider. Mounting
 * the native module here is what makes the MODEL-VISIBLE native `read`/`write`/
 * `edit` execute on the confined lane. No Core patch, no copied tool body, no
 * second mount path: the module is the SAME package the preset mounted.
 *
 * The module is imported by the CALLER (row composition), never resolved here:
 * this seam must not own module-resolution policy (the same discipline that
 * keeps policy compilation out).
 *
 * ORDER IS LOAD-BEARING (review fix, 2026-11-03): the shadow must be created
 * AFTER the Member capability deny lane (`applyBuiltInToolDeny`). An OWN-scope
 * registration sits outside the inherited `tools.restrict` filter, so a deny
 * applied to the inherited surface BEFORE the shadow hides the preset row and
 * lets the shadow take its place; a deny applied AFTER the shadow cannot hide
 * it. The production glue therefore calls `mountNativeToolModules` after the
 * deny block, and the surface-neutrality check compares against the POST-DENY
 * surface.
 */
export interface NativeToolModuleMount {
  /** A Cordis plugin module (already imported): the native tool package's module object. */
  readonly module: Plugin
  /** Plugin config forwarded verbatim to `ctx.plugin`. */
  readonly config?: unknown
  /**
   * S-1 (2026-11-03) — the ToolBinding whose realm this mount's tools execute on.
   *
   * A native tool PACKAGE registers a whole suite from one `apply`
   * (`@deepseek-ai/dsh-tool-fs` registers `read`/`write`/`edit`/`read_image`),
   * so mounting the module into a binding realm applies THAT binding's lane to
   * every sibling tool. A binding-targeted mount therefore installs a
   * REGISTRATION ROUTER over `realm.bindings[i].ctx` (already isolated for
   * `fs`) that forwards only the definition/prompt-section whose tool name is
   * the binding's own tool (`<owner>/<tool>` -> `<tool>`) and drops the rest to
   * their own fibers. A mount WITHOUT a binding identity keeps the ceiling
   * realm and forwards every definition whose tool has NO mounted binding, so
   * the union of the fibers reproduces the module's surface exactly once.
   *
   * The router evaluates NO lane and reads no blueprint: it dispatches to the
   * already-installed realm, whose guard was built from the compiled
   * intersection. A binding identity with no mounted binding realm, or a
   * binding-targeted module that never registers that tool, is a typed refusal
   * (fail closed) — never a silent fallback onto the wider ceiling.
   */
  readonly toolBindingIdentity?: string
  /**
   * PD-29 (2026-11-14) — mount the module DIRECTLY on the Member's isolated
   * scope, with NO registration router.
   *
   * Needed by a module that registers a `tools/result` listener: Cordis filters
   * service-scoped events by the `tools` isolation label, and the router
   * isolates `tools`, so a routed module never receives the dispatch (measured).
   * A direct mount keeps the realm's real `tools` label and its confined `fs`
   * label, registers into the AGENT's tool layer, and is verified by DEFINITION
   * IDENTITY instead of the router's forwarding receipt (see
   * `mountDirectNativeModule`). Refused with a binding identity, without
   * non-empty `expectedTools`, on a deferred registration, or for a name a
   * mounted ToolBinding owns.
   */
  readonly direct?: boolean
  /**
   * ASSEMBLY GAP 1 (2026-11-03) — OBSERVATION-ONLY mount.
   *
   * A binding may only be assigned to the native module that actually OWNS the
   * tool its identity names, and a module does not declare its tools: the only
   * honest source is what its `apply` registers. This flag mounts the module in
   * the CEILING partition behind a router that FORWARDS NOTHING and records the
   * names it would have registered (`a5sfRegistrationRouting.observed`). The
   * live registry is untouched (no tool/section is registered), the fibers are
   * NOT tracked by the realm (the caller disposes them), and the mount performs
   * no post-settle verification because it creates no shadow.
   *
   * Observe-only and normal mounts cannot be mixed in one call, and an
   * observe-only mount cannot name a binding identity (ownership is what the
   * observation is for).
   */
  readonly observeOnly?: boolean
  /**
   * E8 (2026-11-03) — the composition's EXPECTED tool names for this module
   * (the row's `expectedTools` declaration, forwarded verbatim). The seam does
   * not enforce it (the row refuses an unshadowed declaration); it is carried
   * here only so an ACKNOWLEDGED empty frontier can record the declared names
   * (`NativeAttachRecord.acknowledgedNames`) instead of dropping them.
   */
  readonly expectedTools?: readonly string[]
  /**
   * E8 (2026-11-03) — the composition's EXPLICIT opt-out of the empty-frontier
   * refusal (the row's `allowEmpty`, forwarded verbatim). When such an entry
   * forwards NOTHING, the attach records `emptyFrontierAcknowledged: true`:
   * a DECLARED HAZARD, never a verification.
   */
  readonly allowEmpty?: boolean
  /**
   * E8 (2026-11-03) — the ROW-CONFIG specifier this mount came from
   * (`a5sfNativeToolModules[].url`), forwarded verbatim so an accepted-empty
   * frontier can be traced to the configuration entry. Optional: a direct seam
   * caller may omit it.
   */
  readonly specifier?: string
}

/**
 * Post-settle INVALIDATION event (assembly gap 2, 2026-11-03).
 *
 * A routed tool was found on a definition this attach did not create AFTER the
 * mount settled — a late service arrival, a hot update, or a fiber teardown
 * left it on the unshadowed preset path. The realm disposes every router fiber
 * it created (restoring the preset surface VISIBLY) and records this event.
 *
 * P0 (2026-11-03) — WHY DISPOSAL ALONE WAS A LEAK: once the shadow was gone the
 * already-running Member's next call resolved the PRESET definition and
 * executed with zero guard facts, i.e. a managed Member silently fell back to
 * unconstrained execution. `NoStaleShadow ≠ NoUnconfinedExecution`. While this
 * record is non-null the realm therefore DENIES every tool name the attach
 * covered at the existing `tools/pre-execute` admission stage (typed refusal,
 * naming the Member/realm/reason), and re-mounting is refused. Eligibility only
 * returns through a FULL re-assembly (a new realm mount + a new native attach)
 * that passes verification again.
 */
export interface NativeToolInvalidation {
  readonly schema: 'a5sf-native-invalidation/1'
  readonly reason: string
  /** The managed (routed) tool names that are no longer shadowed by this attach. */
  readonly uncovered: readonly string[]
  /**
   * Tool names that APPEARED on the Member's model-visible surface after the
   * mount settled (S-1's measured `+30 ms new name escapes the surface gate`
   * hole). Non-empty even when no managed definition was lost: an unmanaged new
   * name is itself the surface change this seam must not accept silently.
   */
  readonly surfaceAdded: readonly string[]
  /** Tool names that DISAPPEARED from the Member surface after the mount settled. */
  readonly surfaceRemoved: readonly string[]
  /**
   * Managed tool names that were registered by a still-ACTIVE router fiber AFTER
   * the bounded settle window (a late `setTimeout`/IO callback), i.e. after the
   * attach had already accepted and accounted its shadow. They are folded into
   * the managed set first, so the admission deny covers them, and then the realm
   * invalidates: a post-settle registration is a surface this attach did not
   * verify, and accepting it silently was the `a5sf-s1` §3.2 time escape.
   */
  readonly lateRegistrations: readonly string[]
  readonly observedAt: string
}

/**
 * P0 (2026-11-03): the stable machine-readable code carried by the admission
 * refusal's `error.info.code` while a realm's native shadow is invalidated AND
 * the dispatched tool name is one this attach covered.
 *
 * NAME-KEYED PRECEDENCE (E8, 2026-11-03): when the name is in the managed set
 * this SPECIFIC code wins over {@link A5SF_MEMBER_REALM_INVALIDATED}; it names
 * the tool, the Member and the realm that lost its shadow. The blanket code is
 * for every OTHER invocation while the realm is frozen.
 */
export const A5SF_NATIVE_SHADOW_INVALIDATED = 'A5SF_NATIVE_SHADOW_INVALIDATED'

/**
 * E8 (2026-11-03): the stable machine-readable code carried by the admission
 * refusal when a Member's managed realm is INVALIDATED and the dispatched tool
 * name is NOT one this attach covered (including names the attach never saw).
 *
 * WHY A SEPARATE CODE: an invalidated realm refuses EVERY new tool invocation —
 * the boundary has failed, so nothing further executes until a full verified
 * re-assembly. That is a different fact from "this particular managed shadow is
 * gone" ({@link A5SF_NATIVE_SHADOW_INVALIDATED}), and a caller must be able to
 * tell them apart. The generic code says: the Member's realm is invalidated,
 * ALL calls are refused until re-assembly.
 */
export const A5SF_MEMBER_REALM_INVALIDATED = 'A5SF_MEMBER_REALM_INVALIDATED'

/**
 * BL-17 (2026-11-04) — the refusal code for a `subprocess`-consuming native
 * module targeted at a realm that owns NO confined `subprocess` face.
 *
 * WHY IT EXISTS (the external review of Alpha.5): the confined process face is
 * mounted on the MEMBER realm only (`installMemberIoProviders`). The binding
 * realm installs a confined `fs` and NO `subprocess`; a binding-targeted module
 * that injects `subprocess` would therefore resolve the INHERITED, unconfined
 * base service with zero guard facts. That is the class of failure where a
 * proof obtained on one realm is silently wrong on another, so it is refused
 * HERE, at composition time, before any tool definition exists — never
 * documented as a known limitation.
 *
 * The string is the `TeamServiceInstallError.code` (the closed install
 * vocabulary's `SUBPROCESS_UNCONFINED_REALM`); the exported name is the token a
 * caller and a test compare against, so the refusal is typed rather than read
 * out of a message.
 */
export const A5SF_SUBPROCESS_UNCONFINED_REALM = 'SUBPROCESS_UNCONFINED_REALM'

/**
 * BL-17 (2026-11-05) — 旧代 PTY 拒用: the refusal code for a
 * `terminals`-consuming native module targeted at a GOVERNED Member realm.
 *
 * WHY IT EXISTS: the native persistent `bash` module declares
 * `inject: ["tools","terminals"]` and opens its shell through
 * `ctx.terminals.spawn(owner, { type: backendType })`. No realm installs a
 * confined terminal face (P1-08's PTY port is still a test double), so such a
 * module mounted on a governed realm would resolve the INHERITED,
 * legacy-generation host `terminals` service: a persistent shell created
 * OUTSIDE the Member lane, with the policy consumed only at spawn time and a
 * domain that can outlive the revision it was opened under. That is refused
 * HERE, at composition time, before any fiber or tool definition exists — the
 * path is refused, not documented as unused.
 *
 * The string is the `TeamServiceInstallError.code` (the closed install
 * vocabulary's `TERMINALS_LEGACY_PTY_REFUSED`); the exported name is the token
 * a caller and a test compare against.
 */
export const A5SF_TERMINALS_LEGACY_PTY_REFUSED = 'TERMINALS_LEGACY_PTY_REFUSED'

/**
 * BL-18 (P2-05) — the refusal code for a `web`-consuming native module targeted
 * at a realm that owns NO confined `web` face.
 *
 * WHY IT EXISTS: the native `web_fetch`/`web_search` row at the host pin is
 * upstream's `@deepseek-ai/dsh-tool-web`, whose `inject` is
 * `["tools","web","systemPrompt"]` and whose body is
 * `await ctx.web.fetch({ url }, signal)`. The confined `web` face is mounted on
 * the MEMBER realm only and only when the composition supplies one; a realm
 * with no web face would resolve the INHERITED host `ctx.web` (the real HTTP
 * provider, the process-wide proxy dispatcher) with zero guard facts — the same
 * silent widening BL-16/BL-17 refuse on the `subprocess`/`terminals` axes.
 * Refused HERE, at composition time, before any tool definition exists.
 *
 * The string is the `TeamServiceInstallError.code` (the closed install
 * vocabulary's `NETWORK_UNCONFINED_REALM`, already used by product-assembly for
 * the same concept at assembly time); the exported name is the token a caller
 * and a test compare against.
 */
export const A5SF_NETWORK_UNCONFINED_REALM = 'NETWORK_UNCONFINED_REALM'

/**
 * BL-17 (2026-11-04): the service names a plugin module DECLARES it injects.
 *
 * Reads the PUBLIC Cordis plugin metadata (`Plugin.inject`, array or object
 * form — `registry.d.ts` `Inject`) off the SAME object `ctx.plugin` receives.
 * It evaluates no policy and resolves no service: a declaration is metadata,
 * which is exactly why the refusal can fire before any mount.
 */
function declaredInjectionsOf(plugin: Plugin): readonly string[] {
  const declaration = (plugin as { inject?: unknown } | null | undefined)?.inject
  if (Array.isArray(declaration)) return declaration.filter((name): name is string => typeof name === 'string')
  if (declaration !== null && typeof declaration === 'object') return Object.keys(declaration as Record<string, unknown>)
  return []
}

/**
 * E8 (2026-11-03): the ATTACH RECORD of a successful managed native attach.
 *
 * `allowEmpty: true` must never read as "verified safe". When a composition
 * accepts a module whose routed frontier is empty, the attach records that fact
 * here explicitly — it is a DECLARED HAZARD, not a verification: the row cannot
 * see what the preset plane serves for the name, so an acknowledged-empty entry
 * is a statement by the composition, not evidence from the seam.
 *
 * The record is published on the mounted realm (`nativeAttachRecord`) by the
 * successful `mountNativeToolModules` call and is `null` before any attach,
 * after a caller refusal (`disposeNativeToolModules`) and after `dispose()`.
 */
export interface NativeAttachRecord {
  readonly schema: 'a5sf-native-attach/1'
  /** Some accepted module had `allowEmpty: true` AND forwarded nothing. */
  readonly emptyFrontierAcknowledged: boolean
  /** The module names whose empty frontier was acknowledged. */
  readonly emptyFrontierModules: readonly string[]
  /**
   * The ROW-CONFIG specifiers (`a5sfNativeToolModules[].url`) of the
   * acknowledged-empty entries. This is what an operator needs to trace the
   * acceptance back to the configuration line; a boolean alone cannot be
   * followed. Empty when the caller did not supply a specifier (a direct seam
   * call, not the product row).
   */
  readonly emptyFrontierSpecifiers: readonly string[]
  /**
   * The names the acknowledged-empty entries DECLARED through `expectedTools`.
   * They are recorded as ACKNOWLEDGED (unshadowed, unverified), never as
   * verified coverage. Empty when the acknowledged entries declared nothing —
   * which is the ordinary case, because a declared name that no fiber shadows
   * is refused unless the same entry also carries `allowEmpty: true`.
   */
  readonly acknowledgedNames: readonly string[]
}

/** The realm that owned a covered tool's (now disposed) shadow. */
interface ManagedRealm {
  readonly realm: 'ceiling' | 'binding'
  readonly toolBindingIdentity: string | null
}

/**
 * S-1 routing receipt: what ONE router fiber forwarded and dropped, by name.
 * Attached (non-enumerable) to the fiber this mount returned, so a caller can
 * prove the partition per fiber without a second registry.
 */
export interface NativeRegistrationRouting {
  /** Which realm this fiber's forwarded tools execute on. */
  readonly realm: 'ceiling' | 'binding'
  /** The binding identity of a `'binding'` fiber; `null` for the ceiling fiber. */
  readonly toolBindingIdentity: string | null
  /** Tool names this fiber registered on the real `tools` service. */
  readonly forwarded: readonly string[]
  /**
   * EVERY tool name the module attempted to register through this fiber — the
   * union of `forwarded` and `dropped`. An observe-only mount reports its
   * ownership answer here (`forwarded` is empty: nothing was registered).
   */
  readonly observed: readonly string[]
  /**
   * Registration keys this fiber dropped because they belong to another fiber:
   * tool names, and `section:<name>` for the prompt sections it declined.
   */
  readonly dropped: readonly string[]
  /** Prompt-section names (`tool:<name>`) this fiber registered. */
  readonly forwardedSections: readonly string[]
}

/** The property name a router fiber carries its {@link NativeRegistrationRouting} under. */
export const NATIVE_REGISTRATION_ROUTING = 'a5sfRegistrationRouting'

/** The tool name a ToolBinding identity addresses: the last `/` segment of `<owner>/<tool>`. */
function toolNameOfBindingIdentity(toolBindingIdentity: string): string {
  const at = toolBindingIdentity.lastIndexOf('/')
  const name = at === -1 ? toolBindingIdentity : toolBindingIdentity.slice(at + 1)
  return name.trim()
}

/**
 * The Cordis fiber states this seam distinguishes, by their PUBLIC numeric
 * values on `Fiber.state` (0 pending, 1 loading, 2 active, 3 failed, 4 disposed,
 * 5 unloading). Named here so the intent survives a reader who has no Cordis
 * enum at hand; `Fiber.state` itself is public and typed.
 */
const FIBER_FAILED = 3
const FIBER_PENDING = 0
const FIBER_LOADING = 1
const FIBER_UNLOADING = 5

/**
 * The bounded settle window for DEFERRED registrations, in macrotask rounds.
 *
 * WHY ROUNDS, NOT A WALL-CLOCK TIMEOUT: a deferred `ctx.inject(...)` child
 * starts from a microtask (Cordis `_reload` awaits one microtask before running
 * `apply`), so its registration lands within a macrotask on any machine. The
 * rounds are the bound this seam is allowed to wait; a child still transient
 * after them is refused (fail closed) instead of hanging the attach or being
 * accepted with an unknown registration outcome. A module that needs seconds to
 * register its tools is outside this seam's contract — the mount is synchronous
 * setup, and accepting a shadow the seam cannot verify would be #561's leak.
 */
const DEFERRED_SETTLE_ROUNDS = 20

/**
 * The two services THIS mount's registration router provides. A deferred child
 * of the module gets them merged into its inject map (see
 * `routedModuleContext`), because Cordis resolves a service access made from
 * that child against the ROOT isolation label while the child's parent chain
 * carries the router's own label — so the child's `ctx.tools` would throw
 * `cannot get property "tools" without inject` even though the router serves it.
 */
const ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt'] as const

/** Is `fiber` (transitively) a CHILD fiber of `ancestor`? Fiber ancestry, not scope ancestry. */
function isDescendantOf(fiber: Fiber, ancestor: Fiber): boolean {
  let cursor: Context | undefined = fiber.parent
  while (cursor !== undefined) {
    const owner: Fiber | undefined = (cursor as unknown as { fiber?: Fiber }).fiber
    if (owner === ancestor) return true
    cursor = owner?.parent
  }
  return false
}

/** One router fiber's live accounting, published on the fiber once the module loaded. */
interface RegistrationPartition {
  readonly forwarded: Set<string>
  readonly observed: Set<string>
  readonly dropped: Set<string>
  readonly forwardedSections: Set<string>
  /** The exact definition object forwarded per tool name (the coverage signal). */
  readonly forwardedDefinitions: Map<string, unknown>
}

/** The Cordis tracker symbol a `Service` instance carries (it makes `ctx.<service>` context-bound). */
function trackerSymbolOf(service: object): symbol | undefined {
  for (const symbol of Object.getOwnPropertySymbols(service)) {
    const value = Reflect.get(service, symbol)
    if (value !== null && typeof value === 'object' && (value as { property?: unknown }).property === 'ctx') {
      return symbol
    }
  }
  return undefined
}

/**
 * A router whose target is its OWN object, never the live service — AND which
 * carries the service's Cordis tracker so the context binds it to the CALLING
 * context.
 *
 * WHY THE TRACKER MATTERS (measured, not assumed): a `Service` is served
 * through a traceable proxy; the tracker is what lets `ctx.tools.register()`
 * run with `this.ctx` = the ACCESSING context, and therefore what binds the
 * registration effect to the MODULE fiber (so disposing the fiber unregisters
 * the tool). A router WITHOUT the tracker resolves to the service's own ctx
 * instead: registrations would be owned by the realm's fiber and survive the
 * router teardown (measured: the preset definition never came back).
 *
 * WHY THE TARGET IS NOT THE LIVE SERVICE: a proxy whose target IS the traceable
 * proxy inherits the tracker, gets re-wrapped, and the re-wrap reads
 * `register`/`section` from the PROTOTYPE descriptor — silently bypassing the
 * interceptor (measured: the router forwarded nothing).
 */
function createRoutedService(
  real: object,
  fallbackCtx: Context,
  overrides: Record<string, (...args: never[]) => unknown>,
): object {
  const router: Record<PropertyKey, unknown> = Object.create(null) as Record<PropertyKey, unknown>
  for (const [name, fn] of Object.entries(overrides)) router[name] = fn
  const trackerSymbol = trackerSymbolOf(real)
  if (trackerSymbol !== undefined) {
    Object.defineProperty(router, trackerSymbol, {
      value: { associate: 'a5sfRouter', property: 'ctx' },
      enumerable: false,
    })
  }
  return new Proxy(router, {
    get(target, prop) {
      // The tracker symbol (and any other symbol) is the router's OWN state.
      if (typeof prop === 'symbol') return Reflect.get(target, prop)
      if (Object.hasOwn(target, prop)) return Reflect.get(target, prop)
      const value = Reflect.get(real, prop)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
    },
    has(target, prop) {
      if (Object.hasOwn(target, prop)) return true
      return typeof prop === 'string' && prop in real
    },
  })
}

/** The context that OWNS a registration: the accessing ctx Cordis binds, else the realm ctx. */
function owningContextOf(receiver: unknown, fallback: Context): Context {
  const ctx = (receiver as { ctx?: unknown } | undefined)?.ctx
  return ctx !== undefined && ctx !== null ? (ctx as Context) : fallback
}

/**
 * The module context for a routed mount: the router fiber's context PLUS an
 * `inject` that also requires the services this router provides.
 *
 * WHY THIS IS NECESSARY, MEASURED (not assumed): `@deepseek-ai/dsh-tool-fs`
 * registers `read_image` from `ctx.inject(['attachments'], …)`. That child is
 * created under the module fiber, whose service scope is the router's isolated
 * scope. Cordis resolves a direct access from a context against
 * `target[Context.isolate][name]` — the ROOT isolate label — while the walk up
 * the CHILD's parent chain compares against the router's label, so
 * `childCtx.tools` throws `cannot get property "tools" without inject` and the
 * child ends FAILED. (The module's own `ctx.tools` works only because the
 * module fiber's `store` already holds the routed service.) The public fix is
 * to make the deferred child INJECT the routed services itself: its own fiber
 * then stores them, so its registration goes through the SAME router and the
 * partition records it. Nothing is bypassed and no registration reaches the
 * real (preset) `tools` service.
 *
 * Only `tools`/`systemPrompt` are added — the two services the router owns. The
 * child's own declared dependencies (e.g. `attachments`) stay required, so an
 * optional capability that is absent anywhere still leaves the child pending
 * (benign, registers nothing) instead of being forced to run.
 */
function routedModuleContext(routerCtx: Context): Context {
  return routerCtx.extend({
    inject(this: Context, names: unknown, callback: unknown) {
      const plugin = { inject: mergeRoutedInject(names), apply: callback }
      const owner = this as unknown as { plugin: (plugin: unknown, config?: unknown) => unknown }
      return owner.plugin(plugin, undefined)
    },
  } as never) as Context
}

/**
 * Merge the router's two services into a deferred child's declaration WITHOUT
 * changing its SHAPE: an array stays a deduplicated array, and an OBJECT (a
 * name → per-service intercept config map, Cordis `Inject`) stays an object
 * with every declared config preserved. Added services get `null`, the same
 * default `Inject.resolve` assigns to an omitted config (`inject[name] ?? null`),
 * so a per-service intercept config the module declared is never flattened
 * away — dropping it would silently change the child's dependency semantics.
 */
function mergeRoutedInject(names: unknown): unknown {
  if (Array.isArray(names)) return [...new Set([...names, ...ROUTED_SERVICE_NAMES])]
  const declared = (names ?? {}) as Record<string, unknown>
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(declared)) merged[key] = declared[key]
  for (const name of ROUTED_SERVICE_NAMES) if (!(name in merged)) merged[name] = null
  return merged
}

/** Is this descendant fiber still in a transient (not yet settled) state? */
function isTransientFiber(fiber: Fiber): boolean {
  return fiber.state === FIBER_PENDING || fiber.state === FIBER_LOADING || fiber.state === FIBER_UNLOADING
}

/**
 * Settle the deferred-registration window and judge it by OUTCOME, not by
 * reachability: wait (bounded) until every descendant fiber is ACTIVE, FAILED
 * or disposed, then report the two failure shapes — a FAILED child and a child
 * that is still transient after the bound with its declared dependencies
 * satisfiable (a genuinely stuck registration). A PENDING child with an
 * unresolvable declared dependency is an ABSENT OPTIONAL CAPABILITY (measured:
 * the pinned tool-fs always declares `ctx.inject(['attachments'])`); it never
 * ran, never registered, and stays benign.
 */
async function settleDeferredRegistrationWindow(
  descendants: readonly Fiber[],
  target: Context,
): Promise<{ failed: Fiber[]; unsettled: Fiber[] }> {
  for (let round = 0; round < DEFERRED_SETTLE_ROUNDS; round += 1) {
    if (!descendants.some(isTransientFiber)) break
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  const failed = descendants.filter((fiber) => fiber.state === FIBER_FAILED)
  const unsettled = descendants.filter((fiber) => {
    if (!isTransientFiber(fiber)) return false
    if (fiber.state !== FIBER_PENDING) return true
    // PENDING means "waiting for an injected service". If one of the declared
    // names is absent everywhere, the capability simply does not exist here.
    return Object.keys(fiber.inject).every((name) => target.get(name) !== undefined)
  })
  return { failed, unsettled }
}

/**
 * Dispose ONE fiber without letting a never-settling descendant block the
 * refusal path: start the disposal, wait at most the settle bound for it to
 * finish, then continue. A child whose `apply` never resolves keeps its own
 * fiber `inertia` pending (Cordis awaits it on the parent's dispose), so an
 * unbounded `await fiber.dispose()` would make the REFUSAL hang — the exact
 * failure mode this seam must not introduce. The registration effects this
 * mount created are disposed by the same `_unload` pass, concurrently with the
 * stuck child, so the surface is restored even though the overall disposal
 * promise never settles (the stuck child is a broken module's promise, inert
 * after the refusal).
 */
async function disposeFiberBounded(fiber: Fiber): Promise<void> {
  let settled = false
  void Promise.resolve(fiber.dispose()).then(
    () => { settled = true },
    () => { settled = true },
  )
  for (let round = 0; round < DEFERRED_SETTLE_ROUNDS && !settled; round += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

/**
 * The narrowest registration router: intercept `tools.register` and
 * `systemPrompt.section`, forward per the caller's partition, delegate every
 * other member to the REAL service untouched. It reads no policy.
 */
function createRegistrationRouters(
  realTools: object,
  realPrompt: object,
  targetCtx: Context,
  forwardTool: (name: string) => boolean,
  forwardSection: (name: string) => boolean,
): { tools: object; systemPrompt: object; partition: RegistrationPartition } {
  const partition: RegistrationPartition = {
    forwarded: new Set<string>(),
    observed: new Set<string>(),
    dropped: new Set<string>(),
    forwardedSections: new Set<string>(),
    forwardedDefinitions: new Map<string, unknown>(),
  }
  const realRegister = Reflect.get(realTools, 'register') as (definition: unknown) => unknown
  const realSection = Reflect.get(realPrompt, 'section') as (section: unknown) => unknown
  const toolLayers = Reflect.get(realTools, 'layers')
  const promptLayers = Reflect.get(realPrompt, 'layers')
  const tools = createRoutedService(realTools, targetCtx, {
    register(this: unknown, definition: { readonly name?: unknown }) {
      const name = typeof definition?.name === 'string' ? definition.name : undefined
      // A malformed definition is the REAL registry's refusal, never an
      // anonymous drop: forward it so its validation error is the one seen.
      if (name === undefined) {
        return realRegister.call({ layers: toolLayers, ctx: owningContextOf(this, targetCtx) }, definition)
      }
      partition.observed.add(name)
      if (!forwardTool(name)) {
        partition.dropped.add(name)
        return () => {}
      }
      partition.forwarded.add(name)
      partition.forwardedDefinitions.set(name, definition)
      return realRegister.call({ layers: toolLayers, ctx: owningContextOf(this, targetCtx) }, definition)
    },
  })
  const systemPrompt = createRoutedService(realPrompt, targetCtx, {
    section(this: unknown, section: { readonly name?: unknown }) {
      const raw = typeof section?.name === 'string' ? section.name : undefined
      if (raw === undefined) {
        return realSection.call({ layers: promptLayers, ctx: owningContextOf(this, targetCtx) }, section)
      }
      if (!forwardSection(raw)) {
        partition.dropped.add(`section:${raw}`)
        return () => {}
      }
      partition.forwardedSections.add(raw)
      return realSection.call({ layers: promptLayers, ctx: owningContextOf(this, targetCtx) }, section)
    },
  })
  return { tools, systemPrompt, partition }
}

export interface MountA5sfRealmInput {
  readonly root: Context
  readonly members: readonly A5sfRealmMember[]
  /** Binding realms are optional: a Member may mount only its ceiling realm. */
  readonly bindings?: readonly A5sfRealmBinding[]
  readonly providerClass?: FsProviderConstructor
  /** Observe every guard consultation in every realm this call mounts. */
  readonly onGuardConsult?: GuardConsultObserver
  /**
   * BL-16: the confined `subprocess` face for this Member's isolated scope.
   * Omitted = none is mounted (default-preserving). Mounted on the SAME scope
   * the native route re-mounts into, so a `grep`/`glob` definition resolving
   * `ctx.subprocess` gets the confined provider.
   */
  readonly subprocess?: ConfinedSubprocessRealmSpec
  /**
   * BL-18: the confined `web` face for this Member's isolated scope.
   * Omitted = none is mounted (default-preserving), and a `web`-consuming
   * native module is then refused at composition time — never silently served
   * by the inherited host `ctx.web`.
   */
  readonly web?: ConfinedWebRealmSpec
  /**
   * PD-13: the confined `terminals` face for this Member's isolated scope.
   * Omitted = none is mounted (default-preserving), and a `terminals`-consuming
   * native module is then refused at composition time — never silently served
   * by the inherited, legacy-generation PTY service.
   */
  readonly terminal?: ConfinedTerminalRealmSpec
}

export interface MountedA5sfRealm {
  readonly members: readonly MemberServiceSpec[]
  readonly installation: MemberIoInstallation
  readonly bindings: readonly ToolBindingRealm[]
  /**
   * ROUTE C — re-mount NATIVE tool modules into the Member's isolated scope NOW
   * (the caller MUST have applied its capability deny lane first: see the
   * `NativeToolModuleMount` ordering note). The returned fibers are the ones
   * this call created; they are ALREADY tracked for disposal by this realm, and
   * the caller may dispose them individually if its surface-neutrality check
   * fails. Refuses (typed) unless this realm carries exactly ONE Member
   * ceiling: every Member realm inherits the SAME agent scope key, so a second
   * re-mount of the same tool names collides in one scope layer.
   *
   * S-1 (2026-11-03): every mount is installed behind a REGISTRATION ROUTER.
   * A mount carrying `toolBindingIdentity` is mounted on that binding's realm
   * and forwards ONLY the binding's own tool; a mount without one stays on the
   * Member ceiling realm and forwards every tool that has no mounted binding.
   * The union is the module's surface, exactly once, so this remains
   * surface-neutral per fiber.
   *
   * ASSEMBLY GAP 1 (2026-11-03): `options.scope` is the RESOLVED agent scope
   * key the caller already uses for its surface reads. It is REQUIRED to make
   * the post-settle re-verification able to ask `tools.get(name, scope)` which
   * definition the agent now resolves; without it the mount still works, but no
   * definition-identity verification can be scheduled (the caller must then
   * cover that itself — the product row always passes it).
   */
  mountNativeToolModules(
    modules: readonly NativeToolModuleMount[],
    options?: NativeToolModuleMountOptions,
  ): Promise<readonly Fiber[]>
  /**
   * ASSEMBLY GAP 2 — the invalidation event recorded when a post-settle
   * re-verification found a routed tool back on an unshadowed definition.
   * `null` while the mount is healthy (or before anything was mounted).
   */
  readonly nativeInvalidation: NativeToolInvalidation | null
  /**
   * E8 (2026-11-03) — the record of the LAST successful managed attach.
   *
   * LIFECYCLE (corrected 2026-11-04, review #1 C1 — the previous text described
   * a field the code does not produce):
   * - `null` before any attach, and after an attach that was ROLLED BACK
   *   (refused at verification) or abandoned by the caller's own refusal while
   *   the realm was HEALTHY (`disposeNativeToolModules`).
   * - NON-NULL while the realm is invalidated, INCLUDING after
   *   `disposeNativeToolModules()` on that path: that method does not clear it,
   *   because the record describes the attach that WAS verified and then
   *   invalidated, and `nativeInvalidation` is the live signal beside it.
   * - `dispose()` does not clear it either. The realm object is unassembled
   *   after that call; a reader still holding the object gets the last attach's
   *   record and the invalidation record.
   *
   * It exists so an acknowledged empty frontier (`allowEmpty: true`) is an
   * EXPLICIT fact on the assembly record instead of a silence that reads like
   * a verification.
   */
  readonly nativeAttachRecord: NativeAttachRecord | null
  /**
   * Resolves once the bounded post-settle re-verification rounds have run (or
   * an invalidation fired and its teardown settled). Diagnostics/tests only.
   */
  whenNativeVerificationSettled(): Promise<void>
  /**
   * The caller's OWN refusal/abandonment of a successful attach (surface or
   * coverage gate): detach verification, dispose every router fiber, clear the
   * tracked set, and do NOT record an invalidation (the caller reports the
   * refusal). Unlike an invalidation this leaves a later attach possible.
   */
  disposeNativeToolModules(): Promise<void>
  dispose(): Promise<void>
}

/** Options for {@link MountedA5sfRealm.mountNativeToolModules}. */
export interface NativeToolModuleMountOptions {
  /** The resolved agent scope key (`runtimeAgent ?? scopeOf(root)`). */
  readonly scope?: unknown
}

/**
 * Mount one Member's compiled realm (ceiling + zero or more binding realms).
 * Consumes compiled objects only; refuses nothing of its own — every refusal
 * is the owning installer's typed `TeamServiceInstallError`.
 */
export async function mountA5sfRealm(input: MountA5sfRealmInput): Promise<MountedA5sfRealm> {
  const { root } = input
  // The Member ceiling first: a binding realm without its ceiling would enforce
  // the narrower lane while the Member-wide lane stayed decorative.
  const installation = await installMemberIoProviders({
    root,
    members: input.members,
    ...(input.providerClass === undefined ? {} : { providerClass: input.providerClass }),
    ...(input.onGuardConsult === undefined ? {} : { onGuardConsult: input.onGuardConsult }),
    ...(input.subprocess === undefined ? {} : { subprocess: input.subprocess }),
    ...(input.web === undefined ? {} : { web: input.web }),
    ...(input.terminal === undefined ? {} : { terminal: input.terminal }),
  })

  // ROUTE C (2026-11-03): the native tool modules are re-mounted INSIDE the
  // Member's isolated scope by the CALLER, through this realm's
  // `mountNativeToolModules` (the production glue calls it AFTER its capability
  // deny lane — see the ordering note on `NativeToolModuleMount`). One parent
  // fiber per module; disposal rides this realm's own dispose (before the
  // confined Provider fiber), so the shadow can never outlive the confined `fs`
  // it resolves. Teardown failures are COLLECTED and re-thrown after every
  // disposal ran: a swallowed teardown error is the failure mode this replaces.
  const nativeFibers: Fiber[] = []
  const disposeNative = async (): Promise<void> => {
    const errors: unknown[] = []
    for (const fiber of [...nativeFibers].reverse()) {
      try {
        await fiber.dispose()
      } catch (error) {
        errors.push(error)
      }
    }
    nativeFibers.length = 0
    if (errors.length > 0) throw errors[0]
  }
  const disposeNativeQuietly = async (): Promise<void> => {
    try {
      await disposeNative()
    } catch {
      // Rollback path: the ORIGINAL failure is the one reported.
    }
  }

  const mounted: ToolBindingRealm[] = []
  const disposeMounted = async (): Promise<void> => {
    for (const realm of [...mounted].reverse()) {
      try {
        await realm.dispose()
      } catch {
        // Best-effort rollback: the original failure is the one reported.
      }
    }
    mounted.length = 0
  }

  try {
    for (const binding of input.bindings ?? []) {
      const spec: ToolBindingRealmSpec = {
        identity: binding.identity,
        toolBindingIdentity: binding.toolBindingIdentity,
        effective: binding.effective,
        ...(binding.config === undefined ? {} : { config: binding.config }),
      }
      mounted.push(await installToolBindingRealm({
        root,
        spec,
        ...(input.providerClass === undefined ? {} : { providerClass: input.providerClass }),
        ...(input.onGuardConsult === undefined ? {} : { onGuardConsult: input.onGuardConsult }),
      }))
    }
  } catch (error) {
    await disposeMounted()
    await disposeNativeQuietly()
    await installation.dispose()
    throw error
  }

  let disposed = false
  // ASSEMBLY GAP 2 (2026-11-03): post-settle re-verification state. The mount
  // records the exact definition object each routed fiber registered; a later
  // change of what the agent resolves for a MANAGED name means the shadow is
  // gone (a late service arrival, a hot update, or a fiber teardown) and the
  // realm invalidates itself instead of leaving that tool on the unshadowed
  // preset path.
  let invalidation: NativeToolInvalidation | null = null
  let detachVerification: (() => boolean) | undefined
  /**
   * P0 (2026-11-03): the Member ADMISSION listener. Registered with the attach
   * and kept for the realm's life; while `nativeInvalidation !== null` it denies
   * every tool name this attach COVERED, BEFORE the (now preset) definition
   * body runs. This is the existing `tools/pre-execute` admission stage every
   * dispatch already passes through — not a second execution engine and not a
   * second policy compiler: it reads one boolean and a name set.
   */
  let detachAdmission: (() => boolean) | undefined
  let resolveVerification: (() => void) | undefined
  const verificationSettled = new Promise<void>((resolve) => { resolveVerification = resolve })
  /** The in-flight invalidation teardown (resolved when nothing is mounted). */
  let invalidationTeardown: Promise<void> = Promise.resolve()
  /** name -> the exact definition this attach registered (the coverage signal). */
  const expectedDefinitions = new Map<string, unknown>()
  /**
   * E8 (2026-11-03): the LAST successful attach's record. Null before an attach,
   * after the caller's own refusal and after dispose. `emptyFrontierAcknowledged`
   * is a DECLARED HAZARD (see {@link NativeAttachRecord}), never a verification.
   */
  let attachRecord: NativeAttachRecord | null = null
  /**
   * Every registering fiber's LIVE partition, in mount order. The sets are the
   * router's own accounting objects and keep growing while the fiber lives, so
   * continuous verification can see a registration that lands AFTER the bounded
   * settle window (the `a5sf-s1` §3.2 late-timer escape) instead of missing it
   * because the receipt was snapshotted at attach time.
   */
  const managedPartitions: { readonly partition: RegistrationPartition; readonly realm: 'ceiling' | 'binding'; readonly label: string | null }[] = []
  /**
   * P0: name -> the realm that owned its (now disposed) shadow, so a refusal
   * can NAME the realm and the Member instead of being an anonymous error.
   */
  const managedRealmOf = new Map<string, ManagedRealm>()
  /**
   * The Member's model-visible tool NAMES at arm time (post-attach, so the
   * mount's own registrations are in the baseline). A later name-set difference
   * is a surface change S-1's attach-time gate cannot see: a brand-new name at
   * +30 ms escaped it entirely. `undefined` when the tools row cannot list
   * schemas (a double), in which case only definition identity is verified.
   */
  let expectedSurfaceNames: Set<string> | undefined

  /**
   * Fold every registration the attach's LIVE partitions forwarded but the
   * accepted receipt (or the invalidation boundary record) did not record into
   * the MANAGED set, and return the names that were added.
   *
   * WHY THIS EXISTS (event-driven registration shape, 2026-11-03): the pinned
   * `dsh-tool-subagent` registers ONLY from `subagent/provider-added`. When the
   * provider appears after the attach settled, the PRESET plane's listener
   * registers first and its new name trips the surface gate, which sets the
   * invalidation record and DETACHES continuous verification; the MANAGED
   * module's listener for the SAME synchronous emission then registers through
   * the still-live router (the teardown is deferred one microtask, see
   * `invalidateNativeShadow`), so that name is live and confined but was never
   * in the accepted receipt. Denying only the names the receipt knew would let
   * the name fall back to the preset definition once the router is torn down —
   * the measured P0 class. Folding at ADMISSION time keeps the deny's coverage
   * current for exactly the call that would otherwise escape.
   */
  const foldForwardedRegistrations = (): string[] => {
    const folded: string[] = []
    for (const entry of managedPartitions) {
      for (const name of entry.partition.forwarded) {
        if (expectedDefinitions.has(name)) continue
        const definition = entry.partition.forwardedDefinitions.get(name)
        if (definition === undefined) continue
        expectedDefinitions.set(name, definition)
        managedRealmOf.set(name, { realm: entry.realm, toolBindingIdentity: entry.label })
        folded.push(name)
      }
    }
    return folded
  }

  /** The typed refusal for one managed name while the realm is invalid. */
  const refusalOf = (
    name: string,
    record: NativeToolInvalidation,
  ): { readonly reason: string; readonly info: { readonly name: string; readonly code: string } } => {
    const member = installation.members[0]?.identity
    const where = managedRealmOf.get(name)
    const realm = where?.realm === 'binding'
      ? `binding realm ${JSON.stringify(where.toolBindingIdentity)}`
      : 'ceiling realm'
    return {
      reason: `a5sf: managed native tool ${JSON.stringify(name)} is REFUSED — Member `
        + `${JSON.stringify(member?.memberInstanceId ?? null)} (team ${JSON.stringify(member?.teamId ?? null)}, `
        + `generation ${String(member?.instanceGeneration ?? null)}) / ${realm} has an INVALIDATED native shadow; `
        + `reason: ${record.reason}; the preset definition is visible but may not serve this Member until a full `
        + 're-assembly verifies a new shadow',
      info: Object.freeze({ name: 'A5sfNativeShadowInvalidatedError', code: A5SF_NATIVE_SHADOW_INVALIDATED }),
    }
  }

  /**
   * E8 (2026-11-03) — the BLANKET refusal for an invalidated realm.
   *
   * The user ruling this implements: while a Member's managed realm is
   * invalidated, refuse EVERY new tool invocation at the existing admission
   * point, not only the names in `expectedDefinitions`. The boundary has
   * failed, so nothing further should execute; the deny lifts only on a full
   * verified re-assembly, exactly like the name-keyed P0 deny.
   *
   * WHY THE NAME-KEYED CODE STILL EXISTS (precedence, pinned): when the name IS
   * known to be a covered managed name, `refusalOf` answers with the SPECIFIC
   * `A5SF_NATIVE_SHADOW_INVALIDATED` (it names the tool and the realm that lost
   * its shadow). This blanket code answers every OTHER dispatch — including a
   * name that landed in the boundary emission but had not been folded yet, and
   * a name this attach never managed. Merged arms that assert the name-keyed
   * code keep getting it.
   */
  const realmFreezeRefusalOf = (
    record: NativeToolInvalidation,
  ): { readonly reason: string; readonly info: { readonly name: string; readonly code: string } } => {
    const member = installation.members[0]?.identity
    return {
      reason: `a5sf: the Member's managed realm is INVALIDATED — EVERY tool call is REFUSED. Member `
        + `${JSON.stringify(member?.memberInstanceId ?? null)} (team ${JSON.stringify(member?.teamId ?? null)}, `
        + `generation ${String(member?.instanceGeneration ?? null)}) has an INVALIDATED managed realm; `
        + `reason: ${record.reason}; nothing further executes for this Member until a full re-assembly mounts a new `
        + 'realm and a new native attach verifies a new shadow (all calls refused until re-assembly)',
      info: Object.freeze({ name: 'A5sfMemberRealmInvalidatedError', code: A5SF_MEMBER_REALM_INVALIDATED }),
    }
  }

  /**
   * `tools/pre-execute` admission: while the realm is invalid, DENY every call
   * (a known covered name gets its specific name-keyed refusal first); while the
   * realm is healthy, delegate to the rest of the waterfall. Denying here is
   * what makes `NoStaleShadow` imply `NoUnconfinedExecution`: the preset
   * definition may be visible, but it never executes for this Member.
   */
  const admitCoveredTool = (exec: unknown, next: unknown): unknown => {
    const record = invalidation
    const name = (exec as { name?: unknown } | null)?.name
    if (record !== null) {
      // A registration from the SAME synchronous event emission that triggered
      // the record can land after it (see `foldForwardedRegistrations`). Fold on
      // the admission path, which is the one place every dispatch passes
      // through, so the deny covers a name the boundary record never saw.
      foldForwardedRegistrations()
      if (typeof name === 'string' && expectedDefinitions.has(name)) {
        return { kind: 'deny', ...refusalOf(name, record) }
      }
      // E8: not a known covered name — the realm is still frozen. This is the
      // measured intra-emission window (the name had not landed yet) and every
      // other tool of the Member. Refuse; the realm is out of service.
      return { kind: 'deny', ...realmFreezeRefusalOf(record) }
    }
    return typeof next === 'function' ? (next as () => unknown)() : undefined
  }

  /**
   * Dispose the native shadow and RECORD the event. Fail closed: after this the
   * realm refuses further native mounts, so a caller cannot re-create a partial
   * shadow over the same managed names.
   */
  const invalidateNativeShadow = (
    uncovered: readonly string[],
    surfaceAdded: readonly string[] = [],
    surfaceRemoved: readonly string[] = [],
    lateRegistrations: readonly string[] = [],
  ): void => {
    if (disposed || invalidation !== null) return
    const lostShadow = uncovered.length > 0
    const changedSurface = surfaceAdded.length > 0 || surfaceRemoved.length > 0
    const record: NativeToolInvalidation = Object.freeze({
      schema: 'a5sf-native-invalidation/1',
      reason: lateRegistrations.length > 0
        ? 'a managed native tool registered after the mount settled: the attach accepts no post-settle shadow it did not verify'
        : lostShadow && changedSurface
          ? 'the Member surface changed and at least one managed native tool is no longer shadowed by this attach after the mount settled'
          : lostShadow
            ? 'a managed native tool is no longer shadowed by this attach after the mount settled'
            : 'the Member tool surface changed after the native mount settled',
      uncovered: Object.freeze([...new Set(uncovered)]),
      surfaceAdded: Object.freeze([...new Set(surfaceAdded)]),
      surfaceRemoved: Object.freeze([...new Set(surfaceRemoved)]),
      lateRegistrations: Object.freeze([...new Set(lateRegistrations)]),
      observedAt: new Date().toISOString(),
    })
    // ORDER IS LOAD-BEARING (P0, 2026-11-03): the record is set FIRST, so the
    // admission listener (`admitCoveredTool`) already DENIES every covered name
    // before a single router fiber is torn down. Refuse first, then dispose: a
    // dispatch that arrives during the teardown can never be served by the
    // preset, and one already in flight keeps running on its CONFINED body (the
    // existing cancellation/drain path owns it) — there is no window in which an
    // unguarded definition serves this Member. Eligibility does not come back
    // here: `mountNativeToolModules` refuses an invalid realm and the admission
    // deny lasts until this realm is disposed and fully re-assembled.
    invalidation = record
    if (detachVerification !== undefined) {
      try {
        detachVerification()
      } catch {
        // The record below is the report; a listener disposer fault must not
        // stop the teardown.
      }
      detachVerification = undefined
    }
    // THE EVENT RECORD. The realm exposes the typed record (a caller can read
    // `nativeInvalidation`); the process log names it too because the live glue
    // is not changed by this lane. This is a REPORT, not a second authority.
    console.error(
      `a5sf: native tool shadow INVALIDATED (${record.schema}): ${record.reason}; `
      + `uncovered=${JSON.stringify(record.uncovered)}; managed tools are now REFUSED at admission, `
      + 'disposing every router fiber to restore the preset surface',
    )
    // DEFER THE TEARDOWN ONE MICROTASK (event-driven registration shape,
    // 2026-11-03). An invalidation can be triggered by a `tools/change` that
    // fires INSIDE another fiber's synchronous event emission. Measured with the
    // pinned `dsh-tool-subagent`: the PRESET plane registers its tool from
    // `subagent/provider-added` first, the surface gate invalidates, and the
    // router is torn down while the MANAGED module's listener for the SAME event
    // has not run yet; that registration then throws Cordis `INACTIVE_EFFECT`
    // ("cannot create effect on inactive context") out of the provider
    // registration, which rolls the provider back and drops the name. The record
    // is still set synchronously FIRST (the admission deny is armed before any
    // teardown: the P0 order is unchanged); only the DISPOSAL waits for the
    // current synchronous turn to finish, so a registration emitted in that same
    // turn lands on a LIVE router. `admitCoveredTool` folds such a name into the
    // deny set before it evaluates the dispatch (see
    // `foldForwardedRegistrations`), so it cannot escape the refusal either.
    invalidationTeardown = Promise.resolve()
      .then(() => disposeNative())
      .catch((error) => {
        console.error(`a5sf: native shadow invalidation teardown failed: ${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => { resolveVerification?.() })
  }

  /**
   * Verify (a) every routed name still resolves to the definition THIS attach
   * registered and (b) the Member's model-visible tool NAME SET is unchanged.
   */
  const verifyRoutedSurface = (scope: unknown): void => {
    if (disposed || invalidation !== null) return
    if (expectedDefinitions.size === 0 && expectedSurfaceNames === undefined) return
    // C1 (review 2026-11-03): do NOT bail out when no routed fiber is still
    // active. An external holder of the returned fibers can dispose EVERY one of
    // them, which is exactly "the shadow is gone": returning here let the Member
    // fall back to the preset with no record and no deny (the P0 leak class).
    // The row's own refusal path is not distinguished by fiber state — it
    // detaches this verifier and clears `expectedDefinitions` BEFORE disposing
    // (`disposeNativeToolModules`), so it never reaches this check.
    const tools = installation.members[0]?.ctx?.get('tools') as
      | {
        get?: (name: string, scope: unknown) => unknown
        schemas?: (scope: unknown) => readonly unknown[]
      }
      | undefined
    if (tools === undefined || tools === null) return
    try {
      // LATE REGISTRATION (review C1/C2, 2026-11-03): a fiber that was already
      // ACTIVE at settle time can register LATER (a timer/IO callback). The
      // router forwarded it, so it is live and confined, but it was never part
      // of the accepted receipt. FOLD IT IN FIRST (so the admission deny covers
      // it once the shadow is torn down), then invalidate: a post-settle
      // registration is outside what this attach verified, and silently
      // accepting it was the measured `a5sf-s1` §3.2 escape.
      const lateRegistrations = foldForwardedRegistrations()
      const uncovered: string[] = []
      if (typeof tools.get === 'function') {
        for (const [name, definition] of expectedDefinitions) {
          if (tools.get(name, scope) !== definition) uncovered.push(name)
        }
      }
      const surfaceAdded: string[] = []
      const surfaceRemoved: string[] = []
      // (b) S-1's measured `+30 ms new name escapes the surface gate`: a name
      // that did not exist at arm time changes what the model can see, even
      // when no managed definition was lost. Invalidate instead of accepting it
      // silently; this also catches an unmanaged tool DISAPPEARING.
      if (expectedSurfaceNames !== undefined && typeof tools.schemas === 'function') {
        const now = new Set<string>()
        for (const entry of tools.schemas(scope)) {
          const name = typeof entry === 'string'
            ? entry
            : (entry as { name?: unknown } | null)?.name
          if (typeof name === 'string') now.add(name)
        }
        for (const name of now) if (!expectedSurfaceNames.has(name)) surfaceAdded.push(name)
        for (const name of expectedSurfaceNames) if (!now.has(name)) surfaceRemoved.push(name)
      }
      if (lateRegistrations.length > 0 || uncovered.length > 0 || surfaceAdded.length > 0 || surfaceRemoved.length > 0) {
        invalidateNativeShadow(uncovered, surfaceAdded, surfaceRemoved, lateRegistrations)
      }
    } catch {
      // A registry read fault is not evidence of loss; the next change event or
      // settle round re-verifies. The attach's own definition-identity gate in
      // the product row still refuses a mount it cannot verify.
    }
  }

  let verificationScope: unknown
  /** Arm continuous verification (the public `tools/change` event) + bounded settle rounds. */
  /**
   * Take the NAME-SET baseline on the FIRST macrotask after the attach.
   *
   * WHY NOT AT ARM TIME: the product glue registers the Team tools
   * SYNCHRONOUSLY in the same setup turn immediately after
   * `attachA5sfNativeToolModules` returns (measured in `agent-bindings.mjs`:
   * the native attach at ~line 2809, the Team-tool registration loop at ~2834).
   * Those tools are legitimate setup, not a late surface change. Capturing the
   * baseline in the first macrotask absorbs that same-turn setup while still
   * catching a +30 ms-style registration on a later turn (S-1's measured
   * escape). Any `tools/change` BEFORE this baseline is definition-only.
   */
  const captureSurfaceBaseline = (scope: unknown): void => {
    const tools = installation.members[0]?.ctx?.get('tools') as
      | { schemas?: (scope: unknown) => readonly unknown[] }
      | undefined
    if (tools === undefined || tools === null || typeof tools.schemas !== 'function') return
    try {
      const names = new Set<string>()
      for (const entry of tools.schemas(scope)) {
        const name = typeof entry === 'string'
          ? entry
          : (entry as { name?: unknown } | null)?.name
        if (typeof name === 'string') names.add(name)
      }
      expectedSurfaceNames = names
    } catch {
      expectedSurfaceNames = undefined
    }
  }

  const armVerification = (scope: unknown): void => {
    verificationScope = scope
    // P0 (2026-11-03): the two listeners are part of the MANAGED guarantee, so
    // failing to attach either REFUSES the attach (fail closed, typed). The old
    // behaviour — silently degrade to the two bounded rounds — meant a Member
    // could keep running with no continuous invalidation detection at all.
    const memberCtx = installation.members[0]?.ctx as
      | { on?: (name: string, listener: (...args: unknown[]) => unknown) => unknown }
      | undefined
    const refuse = (listener: string, detail: string): TeamServiceInstallError => new TeamServiceInstallError(
      'SERVICE_MOUNT_FAILED',
      `native tool re-mount refused: the Member context cannot attach the '${listener}' listener this managed`
      + ` attach needs to verify its shadow (${detail}); refusing instead of silently falling back to the bounded`
      + ' post-settle rounds only',
    )
    if (typeof memberCtx?.on !== 'function') throw refuse('tools/change', 'ctx.on is unavailable')
    // CONTINUOUS VERIFICATION, without a loader seam: `@deepseek-ai/dsh-tools`
    // emits `tools/change` on every scoped registration/restriction/disposal,
    // so a late arrival or hot update is observed as it happens, not inferred.
    try {
      const detach = memberCtx.on('tools/change', () => { verifyRoutedSurface(verificationScope) })
      detachVerification = typeof detach === 'function' ? detach as () => boolean : undefined
    } catch (error) {
      detachVerification = undefined
      throw refuse('tools/change', error instanceof Error ? error.message : String(error))
    }
    if (detachVerification === undefined) throw refuse('tools/change', 'ctx.on returned no disposer')
    // ADMISSION (P0): the deny path that closes "the shadow is gone, so serve the
    // preset". Registered at the SAME time as verification, so there is no
    // attach that can invalidate without a refusal armed.
    try {
      const detach = memberCtx.on('tools/pre-execute', (exec: unknown, next: unknown) => admitCoveredTool(exec, next))
      detachAdmission = typeof detach === 'function' ? detach as () => boolean : undefined
    } catch (error) {
      detachAdmission = undefined
      try {
        detachVerification()
      } catch {
        // The refusal below is the failure that is reported.
      }
      detachVerification = undefined
      throw refuse('tools/pre-execute', error instanceof Error ? error.message : String(error))
    }
    if (detachAdmission === undefined) {
      try {
        detachVerification()
      } catch {
        // The refusal below is the failure that is reported.
      }
      detachVerification = undefined
      throw refuse('tools/pre-execute', 'ctx.on returned no disposer')
    }
    // BOUNDED POST-SETTLE ROUNDS (the review's explicit requirement): the mount
    // already settled one macrotask for deferred registrations; two MORE
    // macrotasks re-read the routed surface so a registration that lands just
    // after the window is still caught even if its event was missed.
    const round = (remaining: number): void => {
      setTimeout(() => {
        // First macrotask: absorb the caller's own same-turn setup (Team tools),
        // then verify. A later turn is a genuine late change.
        if (expectedSurfaceNames === undefined) captureSurfaceBaseline(verificationScope)
        verifyRoutedSurface(verificationScope)
        if (remaining > 1) round(remaining - 1)
        else resolveVerification?.()
      }, 0)
    }
    round(2)
  }

  return Object.freeze({
    members: Object.freeze([...input.members]),
    installation,
    bindings: Object.freeze([...mounted]),
    get nativeInvalidation(): NativeToolInvalidation | null {
      return invalidation
    },
    get nativeAttachRecord(): NativeAttachRecord | null {
      return attachRecord
    },
    whenNativeVerificationSettled: async (): Promise<void> => {
      await verificationSettled
      // A bounded round may have settled BEFORE the change that invalidated the
      // shadow; awaiting the teardown makes "settled" mean quiescent.
      await invalidationTeardown
    },
    disposeNativeToolModules: async (): Promise<void> => {
      if (disposed) return
      if (detachVerification !== undefined) {
        try {
          detachVerification()
        } catch {
          // The caller's refusal is the failure that is reported.
        }
        detachVerification = undefined
      }
      // A caller's own (pre-invalidation) refusal abandons a HEALTHY attach, so
      // the admission deny has nothing to guard and is detached with it; a later
      // re-attach arms a fresh one. While the realm IS invalid this path must NOT
      // disarm the deny or forget the covered names: the Member stays out of
      // service until the whole realm is disposed and re-assembled.
      if (invalidation === null) {
        if (detachAdmission !== undefined) {
          try {
            detachAdmission()
          } catch {
            // The caller's refusal is the failure that is reported.
          }
          detachAdmission = undefined
        }
        expectedDefinitions.clear()
        managedRealmOf.clear()
        managedPartitions.length = 0
        attachRecord = null
      }
      expectedSurfaceNames = undefined
      await disposeNative()
    },
    mountNativeToolModules: async (
      modules: readonly NativeToolModuleMount[],
      options?: NativeToolModuleMountOptions,
    ): Promise<readonly Fiber[]> => {
      // Refuse BEFORE registering anything: every Member realm shares the
      // agent's DSH scope key, so two re-mounts of the same native names would
      // collide inside one scope layer. One Member ceiling per agent tool plane.
      if (input.members.length !== 1) {
        throw new TeamServiceInstallError(
          'SERVICE_MOUNT_FAILED',
          `native tool re-mount requires exactly one Member ceiling (got ${input.members.length}): every Member realm inherits the same agent scope key, so a second re-mount of the same tool names collides in one scope layer`,
        )
      }
      if (disposed) {
        throw new TeamServiceInstallError(
          'SERVICE_MOUNT_FAILED',
          'native tool re-mount refused: the realm is already disposed',
        )
      }
      if (invalidation !== null) {
        throw new TeamServiceInstallError(
          'SERVICE_MOUNT_FAILED',
          `native tool re-mount refused: this realm's native shadow was invalidated at ${invalidation.observedAt} `
          + `(uncovered ${JSON.stringify(invalidation.uncovered)}); a fresh attach must not re-create a partial shadow`,
        )
      }
      // ASSEMBLY GAP 1: observe-only mounts exist to LEARN module ownership. They
      // register nothing, so they cannot be mixed with real mounts, and naming a
      // binding on one is meaningless (the observation IS the binding answer).
      const observeOnly = modules.length > 0 && modules.every((mount) => mount.observeOnly === true)
      if (modules.some((mount) => (mount.observeOnly === true) !== observeOnly)) {
        throw new TeamServiceInstallError(
          'SERVICE_MOUNT_FAILED',
          'native tool re-mount cannot mix observe-only and registering mounts in one call',
        )
      }
      if (observeOnly && modules.some((mount) => mount.toolBindingIdentity !== undefined)) {
        throw new TeamServiceInstallError(
          'SERVICE_MOUNT_FAILED',
          'an observe-only native tool mount cannot name a ToolBinding (the observation answers which module owns it)',
        )
      }
      // Its `ctx` IS the isolated scope the confined Provider was installed on
      // (`install.ts:182`).
      const memberTarget = installation.members[0]?.ctx
      if (memberTarget === undefined) {
        throw new TeamServiceInstallError(
          'SERVICE_MOUNT_FAILED',
          'native tool re-mount found no installed Member realm to mount into',
        )
      }
      // S-1: the binding-owned tool names are the ONE routing authority. They
      // come from the binding identities P1 already compiled and this realm
      // already mounted — never from a blueprint, never from a lane.
      const bindingRealmOf = (toolBindingIdentity: string): ToolBindingRealm | undefined =>
        mounted.find((realm) => realm.toolBindingIdentity === toolBindingIdentity)
      const bindingToolNames = new Set<string>()
      for (const realm of mounted) {
        const name = toolNameOfBindingIdentity(realm.toolBindingIdentity)
        if (name === '') {
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            `native tool re-mount: mounted binding '${realm.toolBindingIdentity}' addresses no tool name`,
          )
        }
        bindingToolNames.add(name)
      }
      // Refuse BEFORE registering anything: an unknown binding would otherwise
      // fall back onto the wider ceiling realm (a silent widening).
      for (const mount of modules) {
        if (mount.toolBindingIdentity === undefined) continue
        if (bindingRealmOf(mount.toolBindingIdentity) === undefined) {
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            `native tool re-mount names binding '${mount.toolBindingIdentity}' but this realm mounted no such ToolBinding realm`,
          )
        }
      }
      // BL-17 (2026-11-04) — THE INTERSECTION INVARIANT AT THE REALM BOUNDARY.
      //
      // A module that consumes `subprocess` may only be mounted on a realm that
      // OWNS a confined `subprocess` face. The faces come from the installed
      // realm itself (`RealmServiceFaces`, a required answer), never from
      // `target.get('subprocess')`: that lookup returns the INHERITED base
      // service when this realm mounted no shadow, which is precisely the
      // silent widening this refusal replaces. Fires before any fiber/tool is
      // created, so the base service is never even resolved.
      const realmLabelOf = (binding: ToolBindingRealm | undefined): string => binding === undefined
        ? `the Member ceiling realm '${installation.members[0]?.identity.memberInstanceId ?? '<unknown>'}'`
        : `the binding realm '${binding.toolBindingIdentity}'`
      const moduleLabelOf = (mount: NativeToolModuleMount): string => {
        const name = (mount.module as { name?: unknown } | null | undefined)?.name
        const label = typeof name === 'string' && name.trim() !== '' ? name : '<unnamed native module>'
        return mount.specifier === undefined ? label : `${label} (${mount.specifier})`
      }
      const targetsUnconfinedProcessRealm = (mount: NativeToolModuleMount): boolean => {
        if (!declaredInjectionsOf(mount.module).includes('subprocess')) return false
        const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity)
        const faces = binding === undefined ? installation.members[0]?.faces : binding.faces
        return faces === undefined || faces.subprocess === null
      }
      for (const mount of modules) {
        if (!targetsUnconfinedProcessRealm(mount)) continue
        const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity)
        throw new TeamServiceInstallError(
          A5SF_SUBPROCESS_UNCONFINED_REALM,
          `native tool module '${moduleLabelOf(mount)}' injects \`subprocess\`, but ${realmLabelOf(binding)} mounts no confined subprocess face;`
          + ' refusing at composition time instead of letting the module resolve the inherited, unconfined base subprocess service.'
          + ' A realm that must host a process consumer has to install a confined subprocess face on its own isolated scope'
          + ' (the binding realm installs `fs` only today) — a confined Provider that covers one realm is never presented as a'
          + ' general Member×Tool provider',
        )
      }
      // BL-17 (2026-11-05) — 旧代 PTY 拒用, PD-13 (2026-11-11) narrowed: a
      // module that consumes `terminals` (the native persistent-bash path) is
      // admissible ONLY on a realm that OWNS a confined terminal face. The
      // answer comes from the realm's `faces` (a required, total answer), never
      // from `target.get('terminals')` — that lookup returns the INHERITED
      // legacy PTY when this realm mounted no shadow, which is exactly the
      // silent widening this refusal replaces. `faces.terminals === null` keeps
      // the original refusal byte-for-byte for every realm without the face.
      const targetsLegacyPtyRealm = (mount: NativeToolModuleMount): boolean => {
        if (!declaredInjectionsOf(mount.module).includes('terminals')) return false
        const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity)
        const faces = binding === undefined ? installation.members[0]?.faces : binding.faces
        return faces === undefined || faces.terminals === null || faces.terminals === undefined
      }
      for (const mount of modules) {
        if (!targetsLegacyPtyRealm(mount)) continue
        const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity)
        throw new TeamServiceInstallError(
          A5SF_TERMINALS_LEGACY_PTY_REFUSED,
          `native tool module '${moduleLabelOf(mount)}' injects \`terminals\`, but ${realmLabelOf(binding)} mounts no confined terminal face;`
          + ' refusing at composition time instead of letting the module resolve the inherited, legacy-generation host PTY service.'
          + ' A persistent shell is created outside the Member lane and its domain can outlive the policy revision it was opened'
          + ' under (旧代 PTY), so a governed Member is never served by it. A realm that must host a shell consumer has to install'
          + ' the confined terminal face on its own isolated scope (PD-13); until then this path is refused, not documented as unused',
        )
      }
      // BL-18 (P2-05) — the network axis at the realm boundary. A module that
      // consumes `web` (the pinned `tool-web` pair) may only be mounted on a
      // realm that OWNS a confined web face. The answer comes from the realm's
      // `faces` (a required, total answer), never from `target.get('web')` —
      // that lookup returns the inherited host service when this realm mounted
      // no shadow, which is exactly the silent widening this refusal replaces.
      const targetsUnconfinedWebRealm = (mount: NativeToolModuleMount): boolean => {
        if (!declaredInjectionsOf(mount.module).includes('web')) return false
        const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity)
        const faces = binding === undefined ? installation.members[0]?.faces : binding.faces
        return faces === undefined || faces.web === null
      }
      for (const mount of modules) {
        if (!targetsUnconfinedWebRealm(mount)) continue
        const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity)
        throw new TeamServiceInstallError(
          A5SF_NETWORK_UNCONFINED_REALM,
          `native tool module '${moduleLabelOf(mount)}' injects \`web\`, but ${realmLabelOf(binding)} mounts no confined web face;`
          + ' refusing at composition time instead of letting the module resolve the inherited, unconfined host web service'
          + ' (the real HTTP provider plus the process-wide proxy dispatcher, with zero guard facts).'
          + ' A realm that must host a web consumer has to install a confined web face on its own isolated scope',
        )
      }
      const created: Fiber[] = []
      /**
       * E8 (2026-11-03): one entry per REAL mount of THIS attach, so the
       * acknowledged-empty frontier can be recorded after every refusal has
       * passed. Observe-only probes register nothing and never reach here.
       */
      const attachEntries: {
        readonly moduleName: string
        readonly specifier: string | null
        readonly allowEmpty: boolean
        readonly expectedTools: readonly string[]
        readonly forwarded: number
      }[] = []
      const rollbackCreated = async (): Promise<void> => {
        for (const fiber of [...created].reverse()) {
          try {
            await fiber.dispose()
          } catch {
            // Rollback path: the mount failure is the one reported.
          }
        }
        for (const fiber of created) {
          const at = nativeFibers.indexOf(fiber)
          if (at !== -1) nativeFibers.splice(at, 1)
        }
        created.length = 0
        // A refused attach leaves NO managed names behind: the coverage maps
        // describe what THIS attach shadows, so a rollback clears them with it.
        // The LIVE partitions describe disposed fibers after the rollback, so
        // they are cleared too or a later attach's verification would mistake
        // their stale names for a late registration.
        expectedDefinitions.clear()
        managedRealmOf.clear()
        managedPartitions.length = 0
        attachRecord = null
      }
      const routedPartitions = managedPartitions
      /**
       * PD-29 (2026-11-14) — mount ONE module DIRECTLY on the Member's isolated
       * scope, without the registration router.
       *
       * WHY A DIRECT MOUNT EXISTS. The router partitions a module's suite by
       * `isolate('tools', <fresh label>)`. Cordis filters every service-scoped
       * event by the PROVIDER's isolation label, and `tools/result` is dispatched
       * through the `tools` service — so a listener a module registers on a
       * routed context never receives it (measured host-free: the SAME pinned
       * `@deepseek-ai/dsh-tool-present` module appends 1 delivery event mounted
       * directly and 0 behind the router). A module that ships a `tools/result`
       * listener therefore cannot ride the router. Mounting it directly on the
       * member scope keeps the realm's REAL `tools` label (events arrive) and its
       * confined `fs` label (every read is guarded), and its registration lands
       * in the AGENT's tool layer, which shadows the preset row for this agent.
       *
       * WHAT REPLACES THE ROUTER'S PROOF. A routed mount is verified by the
       * router's forwarding receipt; a direct mount is verified by DEFINITION
       * IDENTITY — before/after `tools.get(name, scope)` for every declared
       * `expectedTools` name must differ, or the mount is refused. That receipt
       * is then recorded exactly like a router partition's, so the admission
       * deny, the continuous verification and the coverage gate cover the names
       * the same way.
       *
       * LIMITS (fail closed, each a refusal): no binding identity (a direct mount
       * cannot partition, so it must not claim a ToolBinding's name), non-empty
       * `expectedTools` (its only proof), no deferred registration of any kind (a
       * deferred child would resolve services without the router and bypass the
       * deferred-inject face checks), and no name a mounted binding owns.
       */
      const mountDirectNativeModule = async (mount: NativeToolModuleMount, index: number): Promise<void> => {
        const expected = Array.isArray(mount.expectedTools) ? [...mount.expectedTools] : []
        const moduleLabel = moduleLabelOf(mount)
        function fail(detail: string): never {
          throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', detail)
        }
        if (mount.observeOnly === true) {
          fail(
            `native tool module '${moduleLabel}' declares a DIRECT observe-only mount:`
            + ' an observe-only probe registers nothing, so it cannot prove a shadow by definition identity;'
            + ' observation must ride the registration router',
          )
        }
        if (mount.toolBindingIdentity !== undefined) {
          fail(
            `native tool module '${moduleLabel}' declares a DIRECT mount for binding ${JSON.stringify(mount.toolBindingIdentity)}:`
            + ' a direct mount installs no registration router, so it cannot partition a binding\'s tool; mount it routed',
          )
        }
        if (expected.length === 0 || expected.some((name) => typeof name !== 'string' || name.trim() === '')) {
          fail(
            `native tool module '${moduleLabel}' declares a DIRECT mount without expectedTools:`
            + ' the only shadow proof a direct mount has is definition identity, so it must name the tools it shadows',
          )
        }
        for (const name of expected) {
          if (bindingToolNames.has(name)) {
            fail(
              `native tool module '${moduleLabel}' declares a DIRECT mount of '${name}', which a mounted ToolBinding owns:`
              + ' S-1 routing requires the registration router, so a direct mount would bypass the binding partition',
            )
          }
        }
        const realTools = memberTarget.get('tools') as { get?: (name: string, scope: unknown) => unknown } | undefined
        if (realTools === undefined || realTools === null || typeof realTools.get !== 'function') {
          fail(
            'native tool re-mount needs a tools service that can answer definition identity'
            + ' (the direct mount\'s only shadow proof); refusing instead of mounting an unverifiable shadow',
          )
        }
        const scope = options?.scope
        const before = new Map<string, unknown>(expected.map((name) => [name, realTools.get?.(name, scope)]))
        const windowFibers: Fiber[] = []
        const detachWindow = memberTarget.root.on('internal/plugin', (created: Fiber) => {
          windowFibers.push(created)
        })
        let fiber: Fiber | undefined
        try {
          fiber = await memberTarget.plugin(mount.module, mount.config as never)
          const directFiber: Fiber = fiber
          const descendants = windowFibers
            .filter((created) => created !== directFiber && isDescendantOf(created, directFiber) && created.uid !== null)
          if (descendants.length > 0) {
            fail(
              `native tool module '${moduleLabel}' started ${String(descendants.length)} deferred registration(s) during a DIRECT mount:`
              + ' a deferred child resolves services without the registration router and would bypass the binding partition'
              + ' and the deferred-inject face checks; a direct mount is limited to single-fiber modules',
            )
          }
          const after = new Map<string, unknown>()
          for (const name of expected) {
            const definition = realTools.get?.(name, scope)
            if (definition === undefined || definition === null || definition === before.get(name)) {
              fail(
                `native tool module '${moduleLabel}' was mounted DIRECTLY but did not replace the definition of '${name}'`
                + ' for the agent scope: a direct mount is verified by definition identity, so an unchanged definition would'
                + ' keep executing the preset row\'s (base-fs) implementation',
              )
            }
            after.set(name, definition)
          }
          const partition: RegistrationPartition = {
            forwarded: new Set(expected),
            observed: new Set(expected),
            dropped: new Set(),
            forwardedSections: new Set(),
            forwardedDefinitions: after,
          }
          routedPartitions.push({ realm: 'ceiling', label: null, partition })
          // The SAME routing receipt a routed fiber publishes, so every reader
          // (`unshadowedExpectedTools`, the ownership probe, the attach record)
          // sees a direct mount exactly like a router-verified one. The receipt
          // is HONEST because it was produced by the identity gate above: these
          // names are the ones whose definition this fiber replaced.
          Object.defineProperty(directFiber, NATIVE_REGISTRATION_ROUTING, {
            value: Object.freeze({
              realm: 'ceiling',
              toolBindingIdentity: null,
              forwarded: Object.freeze([...expected]),
              observed: Object.freeze([...expected]),
              dropped: Object.freeze([]),
              forwardedSections: Object.freeze([]),
            }),
            enumerable: false,
            configurable: true,
          })
          for (const [name, definition] of after) {
            expectedDefinitions.set(name, definition)
            managedRealmOf.set(name, { realm: 'ceiling', toolBindingIdentity: null })
          }
          // The per-call fiber list the caller (and the rollback) owns: the
          // routed branch's `created` contract, kept for a direct mount.
          created.push(directFiber)
          nativeFibers.push(directFiber)
          attachEntries.push({
            moduleName: String((mount.module as { name?: unknown } | null)?.name ?? `#${String(index)}`),
            specifier: typeof mount.specifier === 'string' ? mount.specifier : null,
            allowEmpty: mount.allowEmpty === true,
            expectedTools: [...expected],
            forwarded: expected.length,
          })
        } catch (error) {
          if (fiber !== undefined) await disposeFiberBounded(fiber)
          await rollbackCreated()
          if (error instanceof TeamServiceInstallError) throw error
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            `native tool module '${moduleLabel}' direct re-mount failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        } finally {
          detachWindow()
        }
      }
      for (const [index, mount] of modules.entries()) {
        if (mount.direct === true) {
          await mountDirectNativeModule(mount, index)
          continue
        }
        const binding = observeOnly || mount.toolBindingIdentity === undefined
          ? undefined
          : bindingRealmOf(mount.toolBindingIdentity)
        const target = binding?.ctx ?? memberTarget
        const ownedToolName = binding === undefined ? undefined : toolNameOfBindingIdentity(binding.toolBindingIdentity)
        // BL-17: the target realm's OWN answer; never a `ctx.get('subprocess')`
        // lookup (which would answer the inherited base service).
        const targetFaces = binding === undefined ? installation.members[0]?.faces : binding.faces
        const targetHasConfinedSubprocess = targetFaces !== undefined && targetFaces.subprocess !== null
        // BL-18: the target realm's OWN web answer (never `ctx.get('web')`).
        const targetHasConfinedWeb = targetFaces !== undefined && targetFaces.web !== null
        // The REAL services: the router delegates everything except the two
        // registration calls, so the tool bodies see the live registry.
        const realTools = target.get('tools')
        const realPrompt = target.get('systemPrompt')
        if (realTools === undefined || realTools === null) {
          await rollbackCreated()
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            'native tool re-mount needs the tools service on the target context',
          )
        }
        if (realPrompt === undefined || realPrompt === null) {
          await rollbackCreated()
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            'native tool re-mount needs the systemPrompt service on the target context',
          )
        }
        // Observation withdraws every registration: the module executes its real
        // `apply`, the router records what it WOULD have registered, and the live
        // registry is untouched.
        const { tools, systemPrompt, partition } = createRegistrationRouters(
          realTools as object,
          realPrompt as object,
          target,
          (name) => (observeOnly ? false : binding === undefined ? !bindingToolNames.has(name) : name === ownedToolName),
          (name) => {
            if (observeOnly) return false
            // Prompt sections are partitioned the same way as the tools they
            // belong to: `tool:<name>` follows its tool, every other section
            // belongs to the CEILING fiber so it is registered exactly once.
            if (!name.startsWith('tool:')) return binding === undefined
            const toolName = name.slice('tool:'.length)
            return binding === undefined ? !bindingToolNames.has(toolName) : toolName === ownedToolName
          },
        )
        const label = `${binding === undefined ? 'ceiling' : binding.toolBindingIdentity}:${String(index)}`
        // Fresh isolate labels: the router services are visible ONLY to this
        // fiber's own subtree, never to the agent scope or another fiber.
        const routerCtx = target
          .isolate('tools', Symbol(`a5sf-router:tools:${label}`))
          .isolate('systemPrompt', Symbol(`a5sf-router:systemPrompt:${label}`))
        let inner: (Fiber & PromiseLike<Fiber>) | undefined
        let fiber: Fiber | undefined
        // Every fiber created while this mount runs, filtered by ancestry once
        // the router fiber exists (a deferred `ctx.inject` child appears here).
        const windowFibers: Fiber[] = []
        const detachWindow = target.root.on('internal/plugin', (created: Fiber) => {
          windowFibers.push(created)
        })
        try {
          // The router plugin owns the two shadow services and the module fiber
          // as ONE disposable unit. `apply` must NOT await the module: the
          // module's dependencies are satisfied only once this fiber is ACTIVE,
          // so the caller awaits the inner fiber after this one settles.
          fiber = await routerCtx.plugin({
            name: 'a5sf-tool-registration-router',
            apply: (routerContext: Context): void => {
              routerContext.provide('tools', tools as never)
              routerContext.provide('systemPrompt', systemPrompt as never)
            },
          } as never, undefined as never)
          const routerFiber: Fiber = fiber
          // Mount the module from the ALREADY-ACTIVE router fiber's context, as
          // its child, instead of from inside `apply`: a module that registers
          // through a deferred `ctx.inject(...)` needs an active parent context,
          // or its injected child fiber never becomes eligible to start. The
          // module context ALSO merges the router's services into every deferred
          // child's inject (see `routedModuleContext`), which is what lets the
          // child actually register THROUGH this router instead of failing on
          // Cordis's isolate-label walk.
          const moduleCtx = routedModuleContext(routerFiber.ctx)
          inner = moduleCtx.plugin(mount.module, mount.config as never)
          await inner
          // SETTLE, THEN INSPECT (the deferred-registration state machine):
          // wait a bounded number of macrotasks for every descendant fiber to
          // reach a terminal state, then judge the RESULT — a FAILED child or a
          // child that never settles is refused; a child that registered is
          // judged by the partition below. A pending child whose declared
          // capability is absent everywhere is benign (it never ran).
          const descendants = windowFibers
            .filter((created) => created !== routerFiber && isDescendantOf(created, routerFiber) && created.uid !== null)
          const settled = await settleDeferredRegistrationWindow(descendants, target)
          // BL-17 (2026-11-04): the PRE-MOUNT check reads the module's declared
          // `inject`. A module that instead defers `ctx.inject(['subprocess'], …)`
          // declares it only on the CHILD fiber, so the same refusal is applied
          // here — still during composition, before this call returns and before
          // any tool body can run.
          if (!targetHasConfinedSubprocess) {
            const deferredProcess = descendants.filter((created) => 'subprocess' in created.inject)
            if (deferredProcess.length > 0) {
              throw new TeamServiceInstallError(
                A5SF_SUBPROCESS_UNCONFINED_REALM,
                `native tool module '${moduleLabelOf(mount)}' deferred a \`subprocess\` injection`
                + ` (${deferredProcess.map((created) => `[${Object.keys(created.inject).join(',')}]`).join(', ')}),`
                + ` but ${realmLabelOf(binding)} mounts no confined subprocess face; refusing at composition time`
                + ' instead of letting the child resolve the inherited, unconfined base subprocess service',
              )
            }
          }
          // BL-17 (2026-11-05): the same deferred-injection law on the PTY axis
          // (`旧代 PTY 拒用`). A module that defers `ctx.inject(['terminals'], …)`
          // would otherwise mount and later resolve the inherited legacy PTY.
          const deferredTerminal = descendants.filter((created) => 'terminals' in created.inject)
          if (deferredTerminal.length > 0) {
            const terminalFaces = binding === undefined ? installation.members[0]?.faces : binding.faces
            const terminalAdmitted = terminalFaces !== undefined && terminalFaces.terminals !== null && terminalFaces.terminals !== undefined
            if (!terminalAdmitted) {
              throw new TeamServiceInstallError(
                A5SF_TERMINALS_LEGACY_PTY_REFUSED,
                `native tool module '${moduleLabelOf(mount)}' deferred a \`terminals\` injection`
                + ` (${deferredTerminal.map((created) => `[${Object.keys(created.inject).join(',')}]`).join(', ')}),`
                + ` but ${realmLabelOf(binding)} mounts no confined terminal face; refusing at composition time`
                + ' instead of letting the child resolve the inherited, legacy-generation host PTY service',
              )
            }
          }
          // BL-18: the same deferred-injection law on the network axis. A module
          // that defers `ctx.inject(['web'], …)` would otherwise mount and later
          // resolve the inherited host web service.
          if (!targetHasConfinedWeb) {
            const deferredWeb = descendants.filter((created) => 'web' in created.inject)
            if (deferredWeb.length > 0) {
              throw new TeamServiceInstallError(
                A5SF_NETWORK_UNCONFINED_REALM,
                `native tool module '${moduleLabelOf(mount)}' deferred a \`web\` injection`
                + ` (${deferredWeb.map((created) => `[${Object.keys(created.inject).join(',')}]`).join(', ')}),`
                + ` but ${realmLabelOf(binding)} mounts no confined web face; refusing at composition time`
                + ' instead of letting the child resolve the inherited, unconfined host web service',
              )
            }
          }
          if (!observeOnly) {
            // PUBLIC state only: `Fiber.state` is the documented surface, and a
            // fiber at FAILED says the registration threw without this seam
            // reaching into the fiber's private error slot (CORE PATCH BUDGET = 0
            // and AGENTS.md forbid upstream private API). The refusal names the
            // MODULE, its inject names and the public fiber state — it does NOT
            // quote the upstream error text, which this seam never reads.
            const describe = (created: Fiber): string => {
              const deps = Object.keys(created.inject).join(',')
              const state = created.state === FIBER_FAILED ? 'failed' : `state ${String(created.state)}`
              return `deferred registration ${state}, waiting on [${deps}]`
            }
            if (settled.failed.length > 0) {
              throw new TeamServiceInstallError(
                'SERVICE_MOUNT_FAILED',
                `native tool module ${JSON.stringify(mount.toolBindingIdentity ?? null)} started a DEFERRED registration that failed inside the routed mount (${settled.failed.map(describe).join('; ')}); refusing the mount instead of leaving those tools on the unshadowed preset path`,
              )
            }
            if (settled.unsettled.length > 0) {
              throw new TeamServiceInstallError(
                'SERVICE_MOUNT_FAILED',
                `native tool module ${JSON.stringify(mount.toolBindingIdentity ?? null)} started a DEFERRED registration that did not settle within ${String(DEFERRED_SETTLE_ROUNDS)} macrotasks (${settled.unsettled.map(describe).join('; ')}); refusing the mount instead of hanging on it or accepting a shadow it cannot verify`,
              )
            }
          }
        } catch (error) {
          if (typeof detachWindow === 'function') detachWindow()
          if (fiber !== undefined) await disposeFiberBounded(fiber)
          await rollbackCreated()
          // A TYPED refusal thrown by this seam (e.g. the BL-17 unconfined-realm
          // refusal below) keeps its own code: re-wrapping it as a generic mount
          // failure would make the one machine-readable fact unreadable.
          if (error instanceof TeamServiceInstallError) throw error
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            `native tool module re-mount failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        if (typeof detachWindow === 'function') detachWindow()
        created.push(fiber)
        if (!observeOnly) {
          nativeFibers.push(fiber)
          attachEntries.push({
            moduleName: String((mount.module as { name?: unknown } | null)?.name ?? `#${String(index)}`),
            specifier: typeof mount.specifier === 'string' ? mount.specifier : null,
            allowEmpty: mount.allowEmpty === true,
            expectedTools: mount.expectedTools === undefined ? [] : [...mount.expectedTools],
            forwarded: partition.forwarded.size,
          })
          for (const [name, definition] of partition.forwardedDefinitions) expectedDefinitions.set(name, definition)
          // P0: remember which realm owned each covered name so a refusal can
          // name it (binding identity or ceiling).
          for (const name of partition.forwarded) {
            managedRealmOf.set(name, {
              realm: binding === undefined ? 'ceiling' : 'binding',
              toolBindingIdentity: binding?.toolBindingIdentity ?? null,
            })
          }
        }
        if (!observeOnly) {
          routedPartitions.push({
            partition,
            realm: binding === undefined ? 'ceiling' : 'binding',
            label: mount.toolBindingIdentity ?? null,
          })
        }
        const routing: NativeRegistrationRouting = Object.freeze({
          realm: binding === undefined ? 'ceiling' : 'binding',
          toolBindingIdentity: binding?.toolBindingIdentity ?? null,
          forwarded: Object.freeze([...partition.forwarded]),
          observed: Object.freeze([...partition.observed]),
          dropped: Object.freeze([...partition.dropped]),
          forwardedSections: Object.freeze([...partition.forwardedSections]),
        })
        Object.defineProperty(fiber, NATIVE_REGISTRATION_ROUTING, {
          value: routing,
          enumerable: false,
          configurable: true,
        })
        // FAIL CLOSED: a binding-targeted module that never registered the
        // binding's tool cannot enforce that binding's lane. Refuse instead of
        // leaving the tool registered by the wider ceiling fiber.
        if (ownedToolName !== undefined && !partition.forwarded.has(ownedToolName)) {
          await rollbackCreated()
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            `native tool module ${JSON.stringify(mount.toolBindingIdentity)} registers no tool named '${ownedToolName}'; a binding-targeted mount must own its tool (fail closed)`,
          )
        }
      }
      // An observe-only call creates no shadow: the caller OWNS these fibers and
      // disposes them after reading `a5sfRegistrationRouting.observed`.
      if (observeOnly) return Object.freeze([...created])
      // COVERAGE OF THE DEFERRED REGISTRATIONS, judged ONCE per attach (never
      // per fiber — a drop is normally delegated to a sibling fiber). Every name
      // the module attempted to register must be FORWARDED by SOME fiber of this
      // call. A name that no fiber forwards was dropped by every router and
      // therefore never got a confined definition: accepting it would leave the
      // preset definition serving the Member with ZERO guard facts — #561's
      // measured leak. Refuse (fail closed), name the names, and roll back.
      const covered = new Set<string>()
      for (const entry of routedPartitions) for (const name of entry.partition.forwarded) covered.add(name)
      const uncovered = new Map<string, string | null>()
      for (const entry of routedPartitions) {
        for (const name of entry.partition.observed) {
          if (covered.has(name)) continue
          if (!uncovered.has(name)) uncovered.set(name, entry.label)
        }
      }
      if (uncovered.size > 0) {
        await rollbackCreated()
        throw new TeamServiceInstallError(
          'SERVICE_MOUNT_FAILED',
          `native tool module ${JSON.stringify([...new Set(uncovered.values())])} registered UNCOVERED name(s) `
          + `${JSON.stringify([...uncovered.keys()])} through a deferred registration: no fiber of this mount forwards them, `
          + 'so they would stay on the unshadowed preset definition with zero guard facts; refusing the mount (fail closed)',
        )
      }
      // ASSEMBLY GAP 2: arm re-verification AFTER the last registration, so the
      // mount's own writes cannot be mistaken for a later change.
      // P0 (2026-11-03): arming is fail-closed. If either listener cannot be
      // attached the WHOLE attach is rolled back and refused (typed), instead of
      // running a managed Member on the bounded rounds alone.
      try {
        armVerification(options?.scope)
      } catch (error) {
        await rollbackCreated()
        throw error
      }
      // E8 (2026-11-03): publish the attach record. Only an entry that EXPLICITLY
      // opted out of the empty-frontier refusal (`allowEmpty: true`) AND
      // forwarded nothing is an acknowledgement; its declared `expectedTools`
      // names travel with it as ACKNOWLEDGED (unshadowed, unverified) names, so
      // the record can never be read as a verification.
      const acknowledgedEntries = attachEntries.filter((entry) => entry.allowEmpty && entry.forwarded === 0)
      attachRecord = Object.freeze({
        schema: 'a5sf-native-attach/1',
        emptyFrontierAcknowledged: acknowledgedEntries.length > 0,
        emptyFrontierModules: Object.freeze([...new Set(acknowledgedEntries.map((entry) => entry.moduleName))]),
        emptyFrontierSpecifiers: Object.freeze([
          ...new Set(acknowledgedEntries
            .map((entry) => entry.specifier)
            .filter((specifier): specifier is string => specifier !== null)),
        ]),
        acknowledgedNames: Object.freeze([...new Set(acknowledgedEntries.flatMap((entry) => [...entry.expectedTools]))]),
      })
      return Object.freeze([...created])
    },
    dispose: async (): Promise<void> => {
      if (disposed) return
      disposed = true
      if (detachVerification !== undefined) {
        try {
          detachVerification()
        } catch {
          // Reported teardown faults are the fibers' below; a listener already
          // being gone is not a failure.
        }
        detachVerification = undefined
      }
      // P0: the admission deny is dropped only with the WHOLE realm (the Member
      // is unassembled), never while the realm is merely invalid. Until here
      // every covered name was refused.
      //
      // C2 (review 2026-11-03) — THE INVARIANT THIS RELIES ON: after this method
      // returns, the preset plane serves again on this agent ctx. That is only
      // sound while the Member is gone. In PRODUCT the coupling is enforced at
      // `close()` in packages/runtime/src/plugin/live/agent-bindings.mjs: it
      // awaits `handle.dispose()` for every live agent BEFORE it awaits the
      // `a5sfRealmDisposers` this realm was registered with, so a realm is never
      // disposed while its Member's agent ctx is live. A test world (or any
      // future caller) that disposes the realm itself and then keeps dispatching
      // on the SAME live agent ctx is outside the managed-Member lifecycle and
      // will reach the preset; do not "fix" that here — re-assembling a Member
      // means disposing it and creating a new one, which is exactly this method
      // followed by a fresh mount. Pinned by the assembly suite's re-assembly arm
      // (P0-1 step 8) and documented in evidence/a5sf-p0/README.md §11.2.
      if (detachAdmission !== undefined) {
        try {
          detachAdmission()
        } catch {
          // Same rule as the verification disposer above.
        }
        detachAdmission = undefined
      }
      resolveVerification?.()
      // The native shadow is disposed FIRST: once the confined Provider fiber is
      // gone, a surviving shadow would resolve a missing `fs` service (fail
      // closed, but reported as a service fault) instead of the guard's refusal.
      // A teardown failure is REPORTED (never swallowed) and never shortens the
      // rest of the teardown.
      let nativeError: unknown
      try {
        await disposeNative()
      } catch (error) {
        nativeError = error
      }
      await disposeMounted()
      await installation.dispose()
      if (nativeError !== undefined) throw nativeError
    },
  })
}
