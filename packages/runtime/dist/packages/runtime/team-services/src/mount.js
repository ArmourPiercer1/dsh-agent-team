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
 * @module @dsh-agent-team/runtime/team-services/mount
 */
import { installMemberIoProviders, installToolBindingRealm, } from './install.js';
import { TeamServiceInstallError } from './types.js';
/** The property name a router fiber carries its {@link NativeRegistrationRouting} under. */
export const NATIVE_REGISTRATION_ROUTING = 'a5sfRegistrationRouting';
/** The tool name a ToolBinding identity addresses: the last `/` segment of `<owner>/<tool>`. */
function toolNameOfBindingIdentity(toolBindingIdentity) {
    const at = toolBindingIdentity.lastIndexOf('/');
    const name = at === -1 ? toolBindingIdentity : toolBindingIdentity.slice(at + 1);
    return name.trim();
}
/** The Cordis tracker symbol a `Service` instance carries (it makes `ctx.<service>` context-bound). */
function trackerSymbolOf(service) {
    for (const symbol of Object.getOwnPropertySymbols(service)) {
        const value = Reflect.get(service, symbol);
        if (value !== null && typeof value === 'object' && value.property === 'ctx') {
            return symbol;
        }
    }
    return undefined;
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
function createRoutedService(real, fallbackCtx, overrides) {
    const router = Object.create(null);
    for (const [name, fn] of Object.entries(overrides))
        router[name] = fn;
    const trackerSymbol = trackerSymbolOf(real);
    if (trackerSymbol !== undefined) {
        Object.defineProperty(router, trackerSymbol, {
            value: { associate: 'a5sfRouter', property: 'ctx' },
            enumerable: false,
        });
    }
    return new Proxy(router, {
        get(target, prop) {
            // The tracker symbol (and any other symbol) is the router's OWN state.
            if (typeof prop === 'symbol')
                return Reflect.get(target, prop);
            if (Object.hasOwn(target, prop))
                return Reflect.get(target, prop);
            const value = Reflect.get(real, prop);
            return typeof value === 'function' ? value.bind(real) : value;
        },
        has(target, prop) {
            if (Object.hasOwn(target, prop))
                return true;
            return typeof prop === 'string' && prop in real;
        },
    });
}
/** The context that OWNS a registration: the accessing ctx Cordis binds, else the realm ctx. */
function owningContextOf(receiver, fallback) {
    const ctx = receiver?.ctx;
    return ctx !== undefined && ctx !== null ? ctx : fallback;
}
/**
 * The narrowest registration router: intercept `tools.register` and
 * `systemPrompt.section`, forward per the caller's partition, delegate every
 * other member to the REAL service untouched. It reads no policy.
 */
function createRegistrationRouters(realTools, realPrompt, targetCtx, forwardTool, forwardSection) {
    const partition = {
        forwarded: new Set(),
        dropped: new Set(),
        forwardedSections: new Set(),
    };
    const realRegister = Reflect.get(realTools, 'register');
    const realSection = Reflect.get(realPrompt, 'section');
    const toolLayers = Reflect.get(realTools, 'layers');
    const promptLayers = Reflect.get(realPrompt, 'layers');
    const tools = createRoutedService(realTools, targetCtx, {
        register(definition) {
            const name = typeof definition?.name === 'string' ? definition.name : undefined;
            // A malformed definition is the REAL registry's refusal, never an
            // anonymous drop: forward it so its validation error is the one seen.
            if (name === undefined) {
                return realRegister.call({ layers: toolLayers, ctx: owningContextOf(this, targetCtx) }, definition);
            }
            if (!forwardTool(name)) {
                partition.dropped.add(name);
                return () => { };
            }
            partition.forwarded.add(name);
            return realRegister.call({ layers: toolLayers, ctx: owningContextOf(this, targetCtx) }, definition);
        },
    });
    const systemPrompt = createRoutedService(realPrompt, targetCtx, {
        section(section) {
            const raw = typeof section?.name === 'string' ? section.name : undefined;
            if (raw === undefined) {
                return realSection.call({ layers: promptLayers, ctx: owningContextOf(this, targetCtx) }, section);
            }
            if (!forwardSection(raw)) {
                partition.dropped.add(`section:${raw}`);
                return () => { };
            }
            partition.forwardedSections.add(raw);
            return realSection.call({ layers: promptLayers, ctx: owningContextOf(this, targetCtx) }, section);
        },
    });
    return { tools, systemPrompt, partition };
}
/**
 * Mount one Member's compiled realm (ceiling + zero or more binding realms).
 * Consumes compiled objects only; refuses nothing of its own — every refusal
 * is the owning installer's typed `TeamServiceInstallError`.
 */
export async function mountA5sfRealm(input) {
    const { root } = input;
    // The Member ceiling first: a binding realm without its ceiling would enforce
    // the narrower lane while the Member-wide lane stayed decorative.
    const installation = await installMemberIoProviders({
        root,
        members: input.members,
        ...(input.providerClass === undefined ? {} : { providerClass: input.providerClass }),
        ...(input.onGuardConsult === undefined ? {} : { onGuardConsult: input.onGuardConsult }),
    });
    // ROUTE C (2026-11-03): the native tool modules are re-mounted INSIDE the
    // Member's isolated scope by the CALLER, through this realm's
    // `mountNativeToolModules` (the production glue calls it AFTER its capability
    // deny lane — see the ordering note on `NativeToolModuleMount`). One parent
    // fiber per module; disposal rides this realm's own dispose (before the
    // confined Provider fiber), so the shadow can never outlive the confined `fs`
    // it resolves. Teardown failures are COLLECTED and re-thrown after every
    // disposal ran: a swallowed teardown error is the failure mode this replaces.
    const nativeFibers = [];
    const disposeNative = async () => {
        const errors = [];
        for (const fiber of [...nativeFibers].reverse()) {
            try {
                await fiber.dispose();
            }
            catch (error) {
                errors.push(error);
            }
        }
        nativeFibers.length = 0;
        if (errors.length > 0)
            throw errors[0];
    };
    const disposeNativeQuietly = async () => {
        try {
            await disposeNative();
        }
        catch {
            // Rollback path: the ORIGINAL failure is the one reported.
        }
    };
    const mounted = [];
    const disposeMounted = async () => {
        for (const realm of [...mounted].reverse()) {
            try {
                await realm.dispose();
            }
            catch {
                // Best-effort rollback: the original failure is the one reported.
            }
        }
        mounted.length = 0;
    };
    try {
        for (const binding of input.bindings ?? []) {
            const spec = {
                identity: binding.identity,
                toolBindingIdentity: binding.toolBindingIdentity,
                effective: binding.effective,
                ...(binding.config === undefined ? {} : { config: binding.config }),
            };
            mounted.push(await installToolBindingRealm({
                root,
                spec,
                ...(input.providerClass === undefined ? {} : { providerClass: input.providerClass }),
                ...(input.onGuardConsult === undefined ? {} : { onGuardConsult: input.onGuardConsult }),
            }));
        }
    }
    catch (error) {
        await disposeMounted();
        await disposeNativeQuietly();
        await installation.dispose();
        throw error;
    }
    let disposed = false;
    return Object.freeze({
        members: Object.freeze([...input.members]),
        installation,
        bindings: Object.freeze([...mounted]),
        mountNativeToolModules: async (modules) => {
            // Refuse BEFORE registering anything: every Member realm shares the
            // agent's DSH scope key, so two re-mounts of the same native names would
            // collide inside one scope layer. One Member ceiling per agent tool plane.
            if (input.members.length !== 1) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount requires exactly one Member ceiling (got ${input.members.length}): every Member realm inherits the same agent scope key, so a second re-mount of the same tool names collides in one scope layer`);
            }
            if (disposed) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount refused: the realm is already disposed');
            }
            // Its `ctx` IS the isolated scope the confined Provider was installed on
            // (`install.ts:182`).
            const memberTarget = installation.members[0]?.ctx;
            if (memberTarget === undefined) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount found no installed Member realm to mount into');
            }
            // S-1: the binding-owned tool names are the ONE routing authority. They
            // come from the binding identities P1 already compiled and this realm
            // already mounted — never from a blueprint, never from a lane.
            const bindingRealmOf = (toolBindingIdentity) => mounted.find((realm) => realm.toolBindingIdentity === toolBindingIdentity);
            const bindingToolNames = new Set();
            for (const realm of mounted) {
                const name = toolNameOfBindingIdentity(realm.toolBindingIdentity);
                if (name === '') {
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount: mounted binding '${realm.toolBindingIdentity}' addresses no tool name`);
                }
                bindingToolNames.add(name);
            }
            // Refuse BEFORE registering anything: an unknown binding would otherwise
            // fall back onto the wider ceiling realm (a silent widening).
            for (const mount of modules) {
                if (mount.toolBindingIdentity === undefined)
                    continue;
                if (bindingRealmOf(mount.toolBindingIdentity) === undefined) {
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount names binding '${mount.toolBindingIdentity}' but this realm mounted no such ToolBinding realm`);
                }
            }
            const created = [];
            const rollbackCreated = async () => {
                for (const fiber of [...created].reverse()) {
                    try {
                        await fiber.dispose();
                    }
                    catch {
                        // Rollback path: the mount failure is the one reported.
                    }
                }
                for (const fiber of created) {
                    const at = nativeFibers.indexOf(fiber);
                    if (at !== -1)
                        nativeFibers.splice(at, 1);
                }
                created.length = 0;
            };
            for (const [index, mount] of modules.entries()) {
                const binding = mount.toolBindingIdentity === undefined
                    ? undefined
                    : bindingRealmOf(mount.toolBindingIdentity);
                const target = binding?.ctx ?? memberTarget;
                const ownedToolName = binding === undefined ? undefined : toolNameOfBindingIdentity(binding.toolBindingIdentity);
                // The REAL services: the router delegates everything except the two
                // registration calls, so the tool bodies see the live registry.
                const realTools = target.get('tools');
                const realPrompt = target.get('systemPrompt');
                if (realTools === undefined || realTools === null) {
                    await rollbackCreated();
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount needs the tools service on the target context');
                }
                if (realPrompt === undefined || realPrompt === null) {
                    await rollbackCreated();
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount needs the systemPrompt service on the target context');
                }
                const { tools, systemPrompt, partition } = createRegistrationRouters(realTools, realPrompt, target, (name) => (binding === undefined ? !bindingToolNames.has(name) : name === ownedToolName), (name) => {
                    // Prompt sections are partitioned the same way as the tools they
                    // belong to: `tool:<name>` follows its tool, every other section
                    // belongs to the CEILING fiber so it is registered exactly once.
                    if (!name.startsWith('tool:'))
                        return binding === undefined;
                    const toolName = name.slice('tool:'.length);
                    return binding === undefined ? !bindingToolNames.has(toolName) : toolName === ownedToolName;
                });
                const label = `${binding === undefined ? 'ceiling' : binding.toolBindingIdentity}:${String(index)}`;
                // Fresh isolate labels: the router services are visible ONLY to this
                // fiber's own subtree, never to the agent scope or another fiber.
                const routerCtx = target
                    .isolate('tools', Symbol(`a5sf-router:tools:${label}`))
                    .isolate('systemPrompt', Symbol(`a5sf-router:systemPrompt:${label}`));
                let inner;
                let fiber;
                try {
                    // The router plugin owns the two shadow services and the module fiber
                    // as ONE disposable unit. `apply` must NOT await the module: the
                    // module's dependencies are satisfied only once this fiber is ACTIVE,
                    // so the caller awaits the inner fiber after this one settles.
                    fiber = await routerCtx.plugin({
                        name: 'a5sf-tool-registration-router',
                        apply: (routerContext) => {
                            routerContext.provide('tools', tools);
                            routerContext.provide('systemPrompt', systemPrompt);
                            inner = routerContext.plugin(mount.module, mount.config);
                        },
                    }, undefined);
                    if (inner === undefined) {
                        throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool registration router for ${JSON.stringify(mount.toolBindingIdentity ?? null)} mounted no module fiber`);
                    }
                    await inner;
                }
                catch (error) {
                    await fiber?.dispose().catch(() => undefined);
                    await rollbackCreated();
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', error instanceof TeamServiceInstallError
                        ? error.message
                        : `native tool module re-mount failed: ${error instanceof Error ? error.message : String(error)}`);
                }
                created.push(fiber);
                nativeFibers.push(fiber);
                const routing = Object.freeze({
                    realm: binding === undefined ? 'ceiling' : 'binding',
                    toolBindingIdentity: binding?.toolBindingIdentity ?? null,
                    forwarded: Object.freeze([...partition.forwarded]),
                    dropped: Object.freeze([...partition.dropped]),
                    forwardedSections: Object.freeze([...partition.forwardedSections]),
                });
                Object.defineProperty(fiber, NATIVE_REGISTRATION_ROUTING, {
                    value: routing,
                    enumerable: false,
                    configurable: true,
                });
                // FAIL CLOSED: a binding-targeted module that never registered the
                // binding's tool cannot enforce that binding's lane. Refuse instead of
                // leaving the tool registered by the wider ceiling fiber.
                if (ownedToolName !== undefined && !partition.forwarded.has(ownedToolName)) {
                    await rollbackCreated();
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module ${JSON.stringify(mount.toolBindingIdentity)} registers no tool named '${ownedToolName}'; a binding-targeted mount must own its tool (fail closed)`);
                }
            }
            return Object.freeze([...created]);
        },
        dispose: async () => {
            if (disposed)
                return;
            disposed = true;
            // The native shadow is disposed FIRST: once the confined Provider fiber is
            // gone, a surviving shadow would resolve a missing `fs` service (fail
            // closed, but reported as a service fault) instead of the guard's refusal.
            // A teardown failure is REPORTED (never swallowed) and never shortens the
            // rest of the teardown.
            let nativeError;
            try {
                await disposeNative();
            }
            catch (error) {
                nativeError = error;
            }
            await disposeMounted();
            await installation.dispose();
            if (nativeError !== undefined)
                throw nativeError;
        },
    });
}
//# sourceMappingURL=mount.js.map