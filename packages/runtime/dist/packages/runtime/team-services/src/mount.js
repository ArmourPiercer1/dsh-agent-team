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
/** Is `fiber` (transitively) a CHILD fiber of `ancestor`? Fiber ancestry, not scope ancestry. */
function isDescendantOf(fiber, ancestor) {
    let cursor = fiber.parent;
    while (cursor !== undefined) {
        const owner = cursor.fiber;
        if (owner === ancestor)
            return true;
        cursor = owner?.parent;
    }
    return false;
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
        observed: new Set(),
        dropped: new Set(),
        forwardedSections: new Set(),
        forwardedDefinitions: new Map(),
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
            partition.observed.add(name);
            if (!forwardTool(name)) {
                partition.dropped.add(name);
                return () => { };
            }
            partition.forwarded.add(name);
            partition.forwardedDefinitions.set(name, definition);
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
    // ASSEMBLY GAP 2 (2026-11-03): post-settle re-verification state. The mount
    // records the exact definition object each routed fiber registered; a later
    // change of what the agent resolves for a MANAGED name means the shadow is
    // gone (a late service arrival, a hot update, or a fiber teardown) and the
    // realm invalidates itself instead of leaving that tool on the unshadowed
    // preset path.
    let invalidation = null;
    let detachVerification;
    let resolveVerification;
    const verificationSettled = new Promise((resolve) => { resolveVerification = resolve; });
    /** The in-flight invalidation teardown (resolved when nothing is mounted). */
    let invalidationTeardown = Promise.resolve();
    /** name -> the exact definition this attach registered (the coverage signal). */
    const expectedDefinitions = new Map();
    /**
     * Dispose the native shadow and RECORD the event. Fail closed: after this the
     * realm refuses further native mounts, so a caller cannot re-create a partial
     * shadow over the same managed names.
     */
    const invalidateNativeShadow = (uncovered) => {
        if (disposed || invalidation !== null)
            return;
        const record = Object.freeze({
            schema: 'a5sf-native-invalidation/1',
            reason: 'a managed native tool is no longer shadowed by this attach after the mount settled',
            uncovered: Object.freeze([...new Set(uncovered)]),
            observedAt: new Date().toISOString(),
        });
        invalidation = record;
        if (detachVerification !== undefined) {
            try {
                detachVerification();
            }
            catch {
                // The record below is the report; a listener disposer fault must not
                // stop the teardown.
            }
            detachVerification = undefined;
        }
        // THE EVENT RECORD. The realm exposes the typed record (a caller can read
        // `nativeInvalidation`); the process log names it too because the live glue
        // is not changed by this lane. This is a REPORT, not a second authority.
        console.error(`a5sf: native tool shadow INVALIDATED (${record.schema}): ${record.reason}; `
            + `uncovered=${JSON.stringify(record.uncovered)}; disposing every router fiber to restore the preset surface`);
        invalidationTeardown = disposeNative()
            .catch((error) => {
            console.error(`a5sf: native shadow invalidation teardown failed: ${error instanceof Error ? error.message : String(error)}`);
        })
            .finally(() => { resolveVerification?.(); });
    };
    /** Verify every routed name still resolves to the definition THIS attach registered. */
    const verifyRoutedSurface = (scope) => {
        if (disposed || invalidation !== null)
            return;
        if (expectedDefinitions.size === 0)
            return;
        // The row's own refusal path disposes the fibers it was handed; once NONE of
        // this attach's fibers is active there is no shadow left to guard, and the
        // row is reporting its own failure. Do not manufacture an invalidation.
        if (!nativeFibers.some((fiber) => fiber.state === 2))
            return;
        const tools = installation.members[0]?.ctx?.get('tools');
        if (tools === undefined || tools === null || typeof tools.get !== 'function')
            return;
        try {
            const uncovered = [];
            for (const [name, definition] of expectedDefinitions) {
                if (tools.get(name, scope) !== definition)
                    uncovered.push(name);
            }
            if (uncovered.length > 0)
                invalidateNativeShadow(uncovered);
        }
        catch {
            // A registry read fault is not evidence of loss; the next change event or
            // settle round re-verifies. The attach's own definition-identity gate in
            // the product row still refuses a mount it cannot verify.
        }
    };
    let verificationScope;
    /** Arm continuous verification (the public `tools/change` event) + bounded settle rounds. */
    const armVerification = (scope) => {
        verificationScope = scope;
        // CONTINUOUS VERIFICATION, without a loader seam: `@deepseek-ai/dsh-tools`
        // emits `tools/change` on every scoped registration/restriction/disposal,
        // so a late arrival or hot update is observed as it happens, not inferred.
        const memberCtx = installation.members[0]?.ctx;
        if (typeof memberCtx?.on === 'function') {
            try {
                detachVerification = memberCtx.on('tools/change', () => { verifyRoutedSurface(verificationScope); });
            }
            catch {
                detachVerification = undefined;
            }
        }
        // BOUNDED POST-SETTLE ROUNDS (the review's explicit requirement): the mount
        // already settled one macrotask for deferred registrations; two MORE
        // macrotasks re-read the routed surface so a registration that lands just
        // after the window is still caught even if its event was missed.
        const round = (remaining) => {
            setTimeout(() => {
                verifyRoutedSurface(verificationScope);
                if (remaining > 1)
                    round(remaining - 1);
                else
                    resolveVerification?.();
            }, 0);
        };
        round(2);
    };
    return Object.freeze({
        members: Object.freeze([...input.members]),
        installation,
        bindings: Object.freeze([...mounted]),
        get nativeInvalidation() {
            return invalidation;
        },
        whenNativeVerificationSettled: async () => {
            await verificationSettled;
            // A bounded round may have settled BEFORE the change that invalidated the
            // shadow; awaiting the teardown makes "settled" mean quiescent.
            await invalidationTeardown;
        },
        disposeNativeToolModules: async () => {
            if (disposed)
                return;
            if (detachVerification !== undefined) {
                try {
                    detachVerification();
                }
                catch {
                    // The caller's refusal is the failure that is reported.
                }
                detachVerification = undefined;
            }
            expectedDefinitions.clear();
            await disposeNative();
        },
        mountNativeToolModules: async (modules, options) => {
            // Refuse BEFORE registering anything: every Member realm shares the
            // agent's DSH scope key, so two re-mounts of the same native names would
            // collide inside one scope layer. One Member ceiling per agent tool plane.
            if (input.members.length !== 1) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount requires exactly one Member ceiling (got ${input.members.length}): every Member realm inherits the same agent scope key, so a second re-mount of the same tool names collides in one scope layer`);
            }
            if (disposed) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount refused: the realm is already disposed');
            }
            if (invalidation !== null) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount refused: this realm's native shadow was invalidated at ${invalidation.observedAt} `
                    + `(uncovered ${JSON.stringify(invalidation.uncovered)}); a fresh attach must not re-create a partial shadow`);
            }
            // ASSEMBLY GAP 1: observe-only mounts exist to LEARN module ownership. They
            // register nothing, so they cannot be mixed with real mounts, and naming a
            // binding on one is meaningless (the observation IS the binding answer).
            const observeOnly = modules.length > 0 && modules.every((mount) => mount.observeOnly === true);
            if (modules.some((mount) => (mount.observeOnly === true) !== observeOnly)) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'native tool re-mount cannot mix observe-only and registering mounts in one call');
            }
            if (observeOnly && modules.some((mount) => mount.toolBindingIdentity !== undefined)) {
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', 'an observe-only native tool mount cannot name a ToolBinding (the observation answers which module owns it)');
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
                const binding = observeOnly || mount.toolBindingIdentity === undefined
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
                // Observation withdraws every registration: the module executes its real
                // `apply`, the router records what it WOULD have registered, and the live
                // registry is untouched.
                const { tools, systemPrompt, partition } = createRegistrationRouters(realTools, realPrompt, target, (name) => (observeOnly ? false : binding === undefined ? !bindingToolNames.has(name) : name === ownedToolName), (name) => {
                    if (observeOnly)
                        return false;
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
                // Every fiber created while this mount runs, filtered by ancestry once
                // the router fiber exists (a deferred `ctx.inject` child appears here).
                const windowFibers = [];
                const detachWindow = target.root.on('internal/plugin', (created) => {
                    windowFibers.push(created);
                });
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
                        },
                    }, undefined);
                    const routerFiber = fiber;
                    // Mount the module from the ALREADY-ACTIVE router fiber's context, as
                    // its child, instead of from inside `apply`: a module that registers
                    // through a deferred `ctx.inject(...)` needs an active parent context,
                    // or its injected child fiber never becomes eligible to start.
                    inner = routerFiber.ctx.plugin(mount.module, mount.config);
                    await inner;
                    // Settle the deferred-registration window for BOTH mount kinds.
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    if (!observeOnly) {
                        // COVERAGE (S-1): a module may register through a DEFERRED
                        // `ctx.inject(...)` child. Under the router's isolated service scope
                        // that child cannot reach the shadowed services (measured:
                        // `cannot get property "tools" without inject`), so its tool would
                        // stay UNSHADOWED on the preset definition — executing on the BASE
                        // provider with ZERO guard facts while every surface name stayed equal.
                        // Settle the window, then refuse if any descendant fiber did not reach
                        // ACTIVE: a deferred registration is either served by the router or the
                        // whole mount is refused — never silently left on BASE.
                        const unsettled = windowFibers
                            .filter((created) => created !== routerFiber && isDescendantOf(created, routerFiber) && created.uid !== null && created.state !== 2)
                            // An OPTIONAL dependency that is absent everywhere is benign: the
                            // module declares an extra registration it cannot make (measured:
                            // the pinned tool-fs ALWAYS declares `ctx.inject(['attachments'])`).
                            // The dangerous shape is a dependency the REST of this Member CAN
                            // resolve — the preset would have registered that tool, so refusing
                            // is the only way to keep it off the unshadowed BASE path.
                            .filter((created) => Object.keys(created.inject).some((name) => target.get(name) !== undefined));
                        if (unsettled.length > 0) {
                            const detail = unsettled
                                .map((created) => {
                                const deps = Object.keys(created.inject).join(',');
                                const reason = created._error;
                                return reason === undefined ? `deferred registration waiting on [${deps}]` : `deferred registration failed: ${reason instanceof Error ? reason.message : String(reason)}`;
                            })
                                .join('; ');
                            throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module ${JSON.stringify(mount.toolBindingIdentity ?? null)} registers asynchronously and its deferred registration cannot run inside the routed mount (${detail}); refusing the mount instead of leaving those tools on the unshadowed preset path`);
                        }
                    }
                }
                catch (error) {
                    if (typeof detachWindow === 'function')
                        detachWindow();
                    await fiber?.dispose().catch(() => undefined);
                    await rollbackCreated();
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', error instanceof TeamServiceInstallError
                        ? error.detail
                        : `native tool module re-mount failed: ${error instanceof Error ? error.message : String(error)}`);
                }
                if (typeof detachWindow === 'function')
                    detachWindow();
                created.push(fiber);
                if (!observeOnly) {
                    nativeFibers.push(fiber);
                    for (const [name, definition] of partition.forwardedDefinitions)
                        expectedDefinitions.set(name, definition);
                }
                const routing = Object.freeze({
                    realm: binding === undefined ? 'ceiling' : 'binding',
                    toolBindingIdentity: binding?.toolBindingIdentity ?? null,
                    forwarded: Object.freeze([...partition.forwarded]),
                    observed: Object.freeze([...partition.observed]),
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
            // An observe-only call creates no shadow: the caller OWNS these fibers and
            // disposes them after reading `a5sfRegistrationRouting.observed`.
            if (observeOnly)
                return Object.freeze([...created]);
            // ASSEMBLY GAP 2: arm re-verification AFTER the last registration, so the
            // mount's own writes cannot be mistaken for a later change.
            armVerification(options?.scope);
            return Object.freeze([...created]);
        },
        dispose: async () => {
            if (disposed)
                return;
            disposed = true;
            if (detachVerification !== undefined) {
                try {
                    detachVerification();
                }
                catch {
                    // Reported teardown faults are the fibers' below; a listener already
                    // being gone is not a failure.
                }
                detachVerification = undefined;
            }
            resolveVerification?.();
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