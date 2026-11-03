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
 * COVERAGE, NOT JUST NAMES: a module that registers from a DEFERRED
 * `ctx.inject(...)` child cannot register inside the router's isolated service
 * scope (measured: `cannot get property "tools" without inject`, or a child that
 * stays pending). Its tool would then keep executing on the UNGUARDED preset
 * definition while a name-set surface check stayed green. A mount therefore
 * settles its fiber window and REFUSES (typed `SERVICE_MOUNT_FAILED`) when a
 * descendant fiber did not reach ACTIVE and one of its inject names resolves in
 * the surrounding Member scope; an optional dependency that exists nowhere stays
 * benign. Refusing disposes the router fiber, so the surface is restored.
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
   */
  mountNativeToolModules(modules: readonly NativeToolModuleMount[]): Promise<readonly Fiber[]>
  dispose(): Promise<void>
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
  return Object.freeze({
    members: Object.freeze([...input.members]),
    installation,
    bindings: Object.freeze([...mounted]),
    mountNativeToolModules: async (modules: readonly NativeToolModuleMount[]): Promise<readonly Fiber[]> => {
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
      const created: Fiber[] = []
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
      }
      for (const [index, mount] of modules.entries()) {
        const binding = mount.toolBindingIdentity === undefined
          ? undefined
          : bindingRealmOf(mount.toolBindingIdentity)
        const target = binding?.ctx ?? memberTarget
        const ownedToolName = binding === undefined ? undefined : toolNameOfBindingIdentity(binding.toolBindingIdentity)
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
        const { tools, systemPrompt, partition } = createRegistrationRouters(
          realTools as object,
          realPrompt as object,
          target,
          (name) => (binding === undefined ? !bindingToolNames.has(name) : name === ownedToolName),
          (name) => {
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
          // or its injected child fiber never becomes eligible to start.
          inner = routerFiber.ctx.plugin(mount.module, mount.config as never)
          await inner
          // COVERAGE (S-1): a module may register through a DEFERRED
          // `ctx.inject(...)` child. Under the router's isolated service scope
          // that child cannot reach the shadowed services (measured:
          // `cannot get property "tools" without inject`), so its tool would
          // stay UNSHADOWED on the preset definition — executing on the BASE
          // provider with ZERO guard facts while every surface name stayed equal.
          // Settle the window, then refuse if any descendant fiber did not reach
          // ACTIVE: a deferred registration is either served by the router or the
          // whole mount is refused — never silently left on BASE.
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
          const unsettled = windowFibers
            .filter((created) => created !== routerFiber && isDescendantOf(created, routerFiber) && created.uid !== null && created.state !== 2)
            // An OPTIONAL dependency that is absent everywhere is benign: the
            // module declares an extra registration it cannot make (measured:
            // the pinned tool-fs ALWAYS declares `ctx.inject(['attachments'])`).
            // The dangerous shape is a dependency the REST of this Member CAN
            // resolve — the preset would have registered that tool, so refusing
            // is the only way to keep it off the unshadowed BASE path.
            .filter((created) => Object.keys(created.inject).some((name) => target.get(name) !== undefined))
          if (unsettled.length > 0) {
            const detail = unsettled
              .map((created) => {
                const deps = Object.keys(created.inject).join(',')
                const reason = (created as unknown as { _error?: unknown })._error
                return reason === undefined ? `deferred registration waiting on [${deps}]` : `deferred registration failed: ${reason instanceof Error ? reason.message : String(reason)}`
              })
              .join('; ')
            throw new TeamServiceInstallError(
              'SERVICE_MOUNT_FAILED',
              `native tool module ${JSON.stringify(mount.toolBindingIdentity ?? null)} registers asynchronously and its deferred registration cannot run inside the routed mount (${detail}); refusing the mount instead of leaving those tools on the unshadowed preset path`,
            )
          }
        } catch (error) {
          if (typeof detachWindow === 'function') detachWindow()
          await fiber?.dispose().catch(() => undefined)
          await rollbackCreated()
          throw new TeamServiceInstallError(
            'SERVICE_MOUNT_FAILED',
            error instanceof TeamServiceInstallError
              ? error.detail
              : `native tool module re-mount failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        if (typeof detachWindow === 'function') detachWindow()
        created.push(fiber)
        nativeFibers.push(fiber)
        const routing: NativeRegistrationRouting = Object.freeze({
          realm: binding === undefined ? 'ceiling' : 'binding',
          toolBindingIdentity: binding?.toolBindingIdentity ?? null,
          forwarded: Object.freeze([...partition.forwarded]),
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
      return Object.freeze([...created])
    },
    dispose: async (): Promise<void> => {
      if (disposed) return
      disposed = true
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
