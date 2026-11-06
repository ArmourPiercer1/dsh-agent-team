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
import { installMemberIoProviders, installToolBindingRealm, } from './install.js';
import { TeamServiceInstallError } from './types.js';
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
export const A5SF_NATIVE_SHADOW_INVALIDATED = 'A5SF_NATIVE_SHADOW_INVALIDATED';
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
export const A5SF_MEMBER_REALM_INVALIDATED = 'A5SF_MEMBER_REALM_INVALIDATED';
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
export const A5SF_SUBPROCESS_UNCONFINED_REALM = 'SUBPROCESS_UNCONFINED_REALM';
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
export const A5SF_TERMINALS_LEGACY_PTY_REFUSED = 'TERMINALS_LEGACY_PTY_REFUSED';
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
export const A5SF_NETWORK_UNCONFINED_REALM = 'NETWORK_UNCONFINED_REALM';
/**
 * BL-17 (2026-11-04): the service names a plugin module DECLARES it injects.
 *
 * Reads the PUBLIC Cordis plugin metadata (`Plugin.inject`, array or object
 * form — `registry.d.ts` `Inject`) off the SAME object `ctx.plugin` receives.
 * It evaluates no policy and resolves no service: a declaration is metadata,
 * which is exactly why the refusal can fire before any mount.
 */
function declaredInjectionsOf(plugin) {
    const declaration = plugin?.inject;
    if (Array.isArray(declaration))
        return declaration.filter((name) => typeof name === 'string');
    if (declaration !== null && typeof declaration === 'object')
        return Object.keys(declaration);
    return [];
}
/** The property name a router fiber carries its {@link NativeRegistrationRouting} under. */
export const NATIVE_REGISTRATION_ROUTING = 'a5sfRegistrationRouting';
/** The tool name a ToolBinding identity addresses: the last `/` segment of `<owner>/<tool>`. */
function toolNameOfBindingIdentity(toolBindingIdentity) {
    const at = toolBindingIdentity.lastIndexOf('/');
    const name = at === -1 ? toolBindingIdentity : toolBindingIdentity.slice(at + 1);
    return name.trim();
}
/**
 * The Cordis fiber states this seam distinguishes, by their PUBLIC numeric
 * values on `Fiber.state` (0 pending, 1 loading, 2 active, 3 failed, 4 disposed,
 * 5 unloading). Named here so the intent survives a reader who has no Cordis
 * enum at hand; `Fiber.state` itself is public and typed.
 */
const FIBER_FAILED = 3;
const FIBER_PENDING = 0;
const FIBER_LOADING = 1;
const FIBER_UNLOADING = 5;
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
const DEFERRED_SETTLE_ROUNDS = 20;
/**
 * The two services THIS mount's registration router provides. A deferred child
 * of the module gets them merged into its inject map (see
 * `routedModuleContext`), because Cordis resolves a service access made from
 * that child against the ROOT isolation label while the child's parent chain
 * carries the router's own label — so the child's `ctx.tools` would throw
 * `cannot get property "tools" without inject` even though the router serves it.
 */
const ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt'];
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
function routedModuleContext(routerCtx) {
    return routerCtx.extend({
        inject(names, callback) {
            const plugin = { inject: mergeRoutedInject(names), apply: callback };
            const owner = this;
            return owner.plugin(plugin, undefined);
        },
    });
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
function mergeRoutedInject(names) {
    if (Array.isArray(names))
        return [...new Set([...names, ...ROUTED_SERVICE_NAMES])];
    const declared = (names ?? {});
    const merged = {};
    for (const key of Object.keys(declared))
        merged[key] = declared[key];
    for (const name of ROUTED_SERVICE_NAMES)
        if (!(name in merged))
            merged[name] = null;
    return merged;
}
/** Is this descendant fiber still in a transient (not yet settled) state? */
function isTransientFiber(fiber) {
    return fiber.state === FIBER_PENDING || fiber.state === FIBER_LOADING || fiber.state === FIBER_UNLOADING;
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
async function settleDeferredRegistrationWindow(descendants, target) {
    for (let round = 0; round < DEFERRED_SETTLE_ROUNDS; round += 1) {
        if (!descendants.some(isTransientFiber))
            break;
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const failed = descendants.filter((fiber) => fiber.state === FIBER_FAILED);
    const unsettled = descendants.filter((fiber) => {
        if (!isTransientFiber(fiber))
            return false;
        if (fiber.state !== FIBER_PENDING)
            return true;
        // PENDING means "waiting for an injected service". If one of the declared
        // names is absent everywhere, the capability simply does not exist here.
        return Object.keys(fiber.inject).every((name) => target.get(name) !== undefined);
    });
    return { failed, unsettled };
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
async function disposeFiberBounded(fiber) {
    let settled = false;
    void Promise.resolve(fiber.dispose()).then(() => { settled = true; }, () => { settled = true; });
    for (let round = 0; round < DEFERRED_SETTLE_ROUNDS && !settled; round += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
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
        ...(input.subprocess === undefined ? {} : { subprocess: input.subprocess }),
        ...(input.web === undefined ? {} : { web: input.web }),
        ...(input.terminal === undefined ? {} : { terminal: input.terminal }),
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
    /**
     * P0 (2026-11-03): the Member ADMISSION listener. Registered with the attach
     * and kept for the realm's life; while `nativeInvalidation !== null` it denies
     * every tool name this attach COVERED, BEFORE the (now preset) definition
     * body runs. This is the existing `tools/pre-execute` admission stage every
     * dispatch already passes through — not a second execution engine and not a
     * second policy compiler: it reads one boolean and a name set.
     */
    let detachAdmission;
    let resolveVerification;
    const verificationSettled = new Promise((resolve) => { resolveVerification = resolve; });
    /** The in-flight invalidation teardown (resolved when nothing is mounted). */
    let invalidationTeardown = Promise.resolve();
    /** name -> the exact definition this attach registered (the coverage signal). */
    const expectedDefinitions = new Map();
    /**
     * E8 (2026-11-03): the LAST successful attach's record. Null before an attach,
     * after the caller's own refusal and after dispose. `emptyFrontierAcknowledged`
     * is a DECLARED HAZARD (see {@link NativeAttachRecord}), never a verification.
     */
    let attachRecord = null;
    /**
     * Every registering fiber's LIVE partition, in mount order. The sets are the
     * router's own accounting objects and keep growing while the fiber lives, so
     * continuous verification can see a registration that lands AFTER the bounded
     * settle window (the `a5sf-s1` §3.2 late-timer escape) instead of missing it
     * because the receipt was snapshotted at attach time.
     */
    const managedPartitions = [];
    /**
     * P0: name -> the realm that owned its (now disposed) shadow, so a refusal
     * can NAME the realm and the Member instead of being an anonymous error.
     */
    const managedRealmOf = new Map();
    /**
     * The Member's model-visible tool NAMES at arm time (post-attach, so the
     * mount's own registrations are in the baseline). A later name-set difference
     * is a surface change S-1's attach-time gate cannot see: a brand-new name at
     * +30 ms escaped it entirely. `undefined` when the tools row cannot list
     * schemas (a double), in which case only definition identity is verified.
     */
    let expectedSurfaceNames;
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
    const foldForwardedRegistrations = () => {
        const folded = [];
        for (const entry of managedPartitions) {
            for (const name of entry.partition.forwarded) {
                if (expectedDefinitions.has(name))
                    continue;
                const definition = entry.partition.forwardedDefinitions.get(name);
                if (definition === undefined)
                    continue;
                expectedDefinitions.set(name, definition);
                managedRealmOf.set(name, { realm: entry.realm, toolBindingIdentity: entry.label });
                folded.push(name);
            }
        }
        return folded;
    };
    /** The typed refusal for one managed name while the realm is invalid. */
    const refusalOf = (name, record) => {
        const member = installation.members[0]?.identity;
        const where = managedRealmOf.get(name);
        const realm = where?.realm === 'binding'
            ? `binding realm ${JSON.stringify(where.toolBindingIdentity)}`
            : 'ceiling realm';
        return {
            reason: `a5sf: managed native tool ${JSON.stringify(name)} is REFUSED — Member `
                + `${JSON.stringify(member?.memberInstanceId ?? null)} (team ${JSON.stringify(member?.teamId ?? null)}, `
                + `generation ${String(member?.instanceGeneration ?? null)}) / ${realm} has an INVALIDATED native shadow; `
                + `reason: ${record.reason}; the preset definition is visible but may not serve this Member until a full `
                + 're-assembly verifies a new shadow',
            info: Object.freeze({ name: 'A5sfNativeShadowInvalidatedError', code: A5SF_NATIVE_SHADOW_INVALIDATED }),
        };
    };
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
    const realmFreezeRefusalOf = (record) => {
        const member = installation.members[0]?.identity;
        return {
            reason: `a5sf: the Member's managed realm is INVALIDATED — EVERY tool call is REFUSED. Member `
                + `${JSON.stringify(member?.memberInstanceId ?? null)} (team ${JSON.stringify(member?.teamId ?? null)}, `
                + `generation ${String(member?.instanceGeneration ?? null)}) has an INVALIDATED managed realm; `
                + `reason: ${record.reason}; nothing further executes for this Member until a full re-assembly mounts a new `
                + 'realm and a new native attach verifies a new shadow (all calls refused until re-assembly)',
            info: Object.freeze({ name: 'A5sfMemberRealmInvalidatedError', code: A5SF_MEMBER_REALM_INVALIDATED }),
        };
    };
    /**
     * `tools/pre-execute` admission: while the realm is invalid, DENY every call
     * (a known covered name gets its specific name-keyed refusal first); while the
     * realm is healthy, delegate to the rest of the waterfall. Denying here is
     * what makes `NoStaleShadow` imply `NoUnconfinedExecution`: the preset
     * definition may be visible, but it never executes for this Member.
     */
    const admitCoveredTool = (exec, next) => {
        const record = invalidation;
        const name = exec?.name;
        if (record !== null) {
            // A registration from the SAME synchronous event emission that triggered
            // the record can land after it (see `foldForwardedRegistrations`). Fold on
            // the admission path, which is the one place every dispatch passes
            // through, so the deny covers a name the boundary record never saw.
            foldForwardedRegistrations();
            if (typeof name === 'string' && expectedDefinitions.has(name)) {
                return { kind: 'deny', ...refusalOf(name, record) };
            }
            // E8: not a known covered name — the realm is still frozen. This is the
            // measured intra-emission window (the name had not landed yet) and every
            // other tool of the Member. Refuse; the realm is out of service.
            return { kind: 'deny', ...realmFreezeRefusalOf(record) };
        }
        return typeof next === 'function' ? next() : undefined;
    };
    /**
     * Dispose the native shadow and RECORD the event. Fail closed: after this the
     * realm refuses further native mounts, so a caller cannot re-create a partial
     * shadow over the same managed names.
     */
    const invalidateNativeShadow = (uncovered, surfaceAdded = [], surfaceRemoved = [], lateRegistrations = []) => {
        if (disposed || invalidation !== null)
            return;
        const lostShadow = uncovered.length > 0;
        const changedSurface = surfaceAdded.length > 0 || surfaceRemoved.length > 0;
        const record = Object.freeze({
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
        });
        // ORDER IS LOAD-BEARING (P0, 2026-11-03): the record is set FIRST, so the
        // admission listener (`admitCoveredTool`) already DENIES every covered name
        // before a single router fiber is torn down. Refuse first, then dispose: a
        // dispatch that arrives during the teardown can never be served by the
        // preset, and one already in flight keeps running on its CONFINED body (the
        // existing cancellation/drain path owns it) — there is no window in which an
        // unguarded definition serves this Member. Eligibility does not come back
        // here: `mountNativeToolModules` refuses an invalid realm and the admission
        // deny lasts until this realm is disposed and fully re-assembled.
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
            + `uncovered=${JSON.stringify(record.uncovered)}; managed tools are now REFUSED at admission, `
            + 'disposing every router fiber to restore the preset surface');
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
            console.error(`a5sf: native shadow invalidation teardown failed: ${error instanceof Error ? error.message : String(error)}`);
        })
            .finally(() => { resolveVerification?.(); });
    };
    /**
     * Verify (a) every routed name still resolves to the definition THIS attach
     * registered and (b) the Member's model-visible tool NAME SET is unchanged.
     */
    const verifyRoutedSurface = (scope) => {
        if (disposed || invalidation !== null)
            return;
        if (expectedDefinitions.size === 0 && expectedSurfaceNames === undefined)
            return;
        // C1 (review 2026-11-03): do NOT bail out when no routed fiber is still
        // active. An external holder of the returned fibers can dispose EVERY one of
        // them, which is exactly "the shadow is gone": returning here let the Member
        // fall back to the preset with no record and no deny (the P0 leak class).
        // The row's own refusal path is not distinguished by fiber state — it
        // detaches this verifier and clears `expectedDefinitions` BEFORE disposing
        // (`disposeNativeToolModules`), so it never reaches this check.
        const tools = installation.members[0]?.ctx?.get('tools');
        if (tools === undefined || tools === null)
            return;
        try {
            // LATE REGISTRATION (review C1/C2, 2026-11-03): a fiber that was already
            // ACTIVE at settle time can register LATER (a timer/IO callback). The
            // router forwarded it, so it is live and confined, but it was never part
            // of the accepted receipt. FOLD IT IN FIRST (so the admission deny covers
            // it once the shadow is torn down), then invalidate: a post-settle
            // registration is outside what this attach verified, and silently
            // accepting it was the measured `a5sf-s1` §3.2 escape.
            const lateRegistrations = foldForwardedRegistrations();
            const uncovered = [];
            if (typeof tools.get === 'function') {
                for (const [name, definition] of expectedDefinitions) {
                    if (tools.get(name, scope) !== definition)
                        uncovered.push(name);
                }
            }
            const surfaceAdded = [];
            const surfaceRemoved = [];
            // (b) S-1's measured `+30 ms new name escapes the surface gate`: a name
            // that did not exist at arm time changes what the model can see, even
            // when no managed definition was lost. Invalidate instead of accepting it
            // silently; this also catches an unmanaged tool DISAPPEARING.
            if (expectedSurfaceNames !== undefined && typeof tools.schemas === 'function') {
                const now = new Set();
                for (const entry of tools.schemas(scope)) {
                    const name = typeof entry === 'string'
                        ? entry
                        : entry?.name;
                    if (typeof name === 'string')
                        now.add(name);
                }
                for (const name of now)
                    if (!expectedSurfaceNames.has(name))
                        surfaceAdded.push(name);
                for (const name of expectedSurfaceNames)
                    if (!now.has(name))
                        surfaceRemoved.push(name);
            }
            if (lateRegistrations.length > 0 || uncovered.length > 0 || surfaceAdded.length > 0 || surfaceRemoved.length > 0) {
                invalidateNativeShadow(uncovered, surfaceAdded, surfaceRemoved, lateRegistrations);
            }
        }
        catch {
            // A registry read fault is not evidence of loss; the next change event or
            // settle round re-verifies. The attach's own definition-identity gate in
            // the product row still refuses a mount it cannot verify.
        }
    };
    let verificationScope;
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
    const captureSurfaceBaseline = (scope) => {
        const tools = installation.members[0]?.ctx?.get('tools');
        if (tools === undefined || tools === null || typeof tools.schemas !== 'function')
            return;
        try {
            const names = new Set();
            for (const entry of tools.schemas(scope)) {
                const name = typeof entry === 'string'
                    ? entry
                    : entry?.name;
                if (typeof name === 'string')
                    names.add(name);
            }
            expectedSurfaceNames = names;
        }
        catch {
            expectedSurfaceNames = undefined;
        }
    };
    const armVerification = (scope) => {
        verificationScope = scope;
        // P0 (2026-11-03): the two listeners are part of the MANAGED guarantee, so
        // failing to attach either REFUSES the attach (fail closed, typed). The old
        // behaviour — silently degrade to the two bounded rounds — meant a Member
        // could keep running with no continuous invalidation detection at all.
        const memberCtx = installation.members[0]?.ctx;
        const refuse = (listener, detail) => new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool re-mount refused: the Member context cannot attach the '${listener}' listener this managed`
            + ` attach needs to verify its shadow (${detail}); refusing instead of silently falling back to the bounded`
            + ' post-settle rounds only');
        if (typeof memberCtx?.on !== 'function')
            throw refuse('tools/change', 'ctx.on is unavailable');
        // CONTINUOUS VERIFICATION, without a loader seam: `@deepseek-ai/dsh-tools`
        // emits `tools/change` on every scoped registration/restriction/disposal,
        // so a late arrival or hot update is observed as it happens, not inferred.
        try {
            const detach = memberCtx.on('tools/change', () => { verifyRoutedSurface(verificationScope); });
            detachVerification = typeof detach === 'function' ? detach : undefined;
        }
        catch (error) {
            detachVerification = undefined;
            throw refuse('tools/change', error instanceof Error ? error.message : String(error));
        }
        if (detachVerification === undefined)
            throw refuse('tools/change', 'ctx.on returned no disposer');
        // ADMISSION (P0): the deny path that closes "the shadow is gone, so serve the
        // preset". Registered at the SAME time as verification, so there is no
        // attach that can invalidate without a refusal armed.
        try {
            const detach = memberCtx.on('tools/pre-execute', (exec, next) => admitCoveredTool(exec, next));
            detachAdmission = typeof detach === 'function' ? detach : undefined;
        }
        catch (error) {
            detachAdmission = undefined;
            try {
                detachVerification();
            }
            catch {
                // The refusal below is the failure that is reported.
            }
            detachVerification = undefined;
            throw refuse('tools/pre-execute', error instanceof Error ? error.message : String(error));
        }
        if (detachAdmission === undefined) {
            try {
                detachVerification();
            }
            catch {
                // The refusal below is the failure that is reported.
            }
            detachVerification = undefined;
            throw refuse('tools/pre-execute', 'ctx.on returned no disposer');
        }
        // BOUNDED POST-SETTLE ROUNDS (the review's explicit requirement): the mount
        // already settled one macrotask for deferred registrations; two MORE
        // macrotasks re-read the routed surface so a registration that lands just
        // after the window is still caught even if its event was missed.
        const round = (remaining) => {
            setTimeout(() => {
                // First macrotask: absorb the caller's own same-turn setup (Team tools),
                // then verify. A later turn is a genuine late change.
                if (expectedSurfaceNames === undefined)
                    captureSurfaceBaseline(verificationScope);
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
        get nativeAttachRecord() {
            return attachRecord;
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
            // A caller's own (pre-invalidation) refusal abandons a HEALTHY attach, so
            // the admission deny has nothing to guard and is detached with it; a later
            // re-attach arms a fresh one. While the realm IS invalid this path must NOT
            // disarm the deny or forget the covered names: the Member stays out of
            // service until the whole realm is disposed and re-assembled.
            if (invalidation === null) {
                if (detachAdmission !== undefined) {
                    try {
                        detachAdmission();
                    }
                    catch {
                        // The caller's refusal is the failure that is reported.
                    }
                    detachAdmission = undefined;
                }
                expectedDefinitions.clear();
                managedRealmOf.clear();
                managedPartitions.length = 0;
                attachRecord = null;
            }
            expectedSurfaceNames = undefined;
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
            // BL-17 (2026-11-04) — THE INTERSECTION INVARIANT AT THE REALM BOUNDARY.
            //
            // A module that consumes `subprocess` may only be mounted on a realm that
            // OWNS a confined `subprocess` face. The faces come from the installed
            // realm itself (`RealmServiceFaces`, a required answer), never from
            // `target.get('subprocess')`: that lookup returns the INHERITED base
            // service when this realm mounted no shadow, which is precisely the
            // silent widening this refusal replaces. Fires before any fiber/tool is
            // created, so the base service is never even resolved.
            const realmLabelOf = (binding) => binding === undefined
                ? `the Member ceiling realm '${installation.members[0]?.identity.memberInstanceId ?? '<unknown>'}'`
                : `the binding realm '${binding.toolBindingIdentity}'`;
            const moduleLabelOf = (mount) => {
                const name = mount.module?.name;
                const label = typeof name === 'string' && name.trim() !== '' ? name : '<unnamed native module>';
                return mount.specifier === undefined ? label : `${label} (${mount.specifier})`;
            };
            const targetsUnconfinedProcessRealm = (mount) => {
                if (!declaredInjectionsOf(mount.module).includes('subprocess'))
                    return false;
                const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity);
                const faces = binding === undefined ? installation.members[0]?.faces : binding.faces;
                return faces === undefined || faces.subprocess === null;
            };
            for (const mount of modules) {
                if (!targetsUnconfinedProcessRealm(mount))
                    continue;
                const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity);
                throw new TeamServiceInstallError(A5SF_SUBPROCESS_UNCONFINED_REALM, `native tool module '${moduleLabelOf(mount)}' injects \`subprocess\`, but ${realmLabelOf(binding)} mounts no confined subprocess face;`
                    + ' refusing at composition time instead of letting the module resolve the inherited, unconfined base subprocess service.'
                    + ' A realm that must host a process consumer has to install a confined subprocess face on its own isolated scope'
                    + ' (the binding realm installs `fs` only today) — a confined Provider that covers one realm is never presented as a'
                    + ' general Member×Tool provider');
            }
            // BL-17 (2026-11-05) — 旧代 PTY 拒用, PD-13 (2026-11-11) narrowed: a
            // module that consumes `terminals` (the native persistent-bash path) is
            // admissible ONLY on a realm that OWNS a confined terminal face. The
            // answer comes from the realm's `faces` (a required, total answer), never
            // from `target.get('terminals')` — that lookup returns the INHERITED
            // legacy PTY when this realm mounted no shadow, which is exactly the
            // silent widening this refusal replaces. `faces.terminals === null` keeps
            // the original refusal byte-for-byte for every realm without the face.
            const targetsLegacyPtyRealm = (mount) => {
                if (!declaredInjectionsOf(mount.module).includes('terminals'))
                    return false;
                const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity);
                const faces = binding === undefined ? installation.members[0]?.faces : binding.faces;
                return faces === undefined || faces.terminals === null || faces.terminals === undefined;
            };
            for (const mount of modules) {
                if (!targetsLegacyPtyRealm(mount))
                    continue;
                const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity);
                throw new TeamServiceInstallError(A5SF_TERMINALS_LEGACY_PTY_REFUSED, `native tool module '${moduleLabelOf(mount)}' injects \`terminals\`, but ${realmLabelOf(binding)} mounts no confined terminal face;`
                    + ' refusing at composition time instead of letting the module resolve the inherited, legacy-generation host PTY service.'
                    + ' A persistent shell is created outside the Member lane and its domain can outlive the policy revision it was opened'
                    + ' under (旧代 PTY), so a governed Member is never served by it. A realm that must host a shell consumer has to install'
                    + ' the confined terminal face on its own isolated scope (PD-13); until then this path is refused, not documented as unused');
            }
            // BL-18 (P2-05) — the network axis at the realm boundary. A module that
            // consumes `web` (the pinned `tool-web` pair) may only be mounted on a
            // realm that OWNS a confined web face. The answer comes from the realm's
            // `faces` (a required, total answer), never from `target.get('web')` —
            // that lookup returns the inherited host service when this realm mounted
            // no shadow, which is exactly the silent widening this refusal replaces.
            const targetsUnconfinedWebRealm = (mount) => {
                if (!declaredInjectionsOf(mount.module).includes('web'))
                    return false;
                const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity);
                const faces = binding === undefined ? installation.members[0]?.faces : binding.faces;
                return faces === undefined || faces.web === null;
            };
            for (const mount of modules) {
                if (!targetsUnconfinedWebRealm(mount))
                    continue;
                const binding = mount.toolBindingIdentity === undefined ? undefined : bindingRealmOf(mount.toolBindingIdentity);
                throw new TeamServiceInstallError(A5SF_NETWORK_UNCONFINED_REALM, `native tool module '${moduleLabelOf(mount)}' injects \`web\`, but ${realmLabelOf(binding)} mounts no confined web face;`
                    + ' refusing at composition time instead of letting the module resolve the inherited, unconfined host web service'
                    + ' (the real HTTP provider plus the process-wide proxy dispatcher, with zero guard facts).'
                    + ' A realm that must host a web consumer has to install a confined web face on its own isolated scope');
            }
            const created = [];
            /**
             * E8 (2026-11-03): one entry per REAL mount of THIS attach, so the
             * acknowledged-empty frontier can be recorded after every refusal has
             * passed. Observe-only probes register nothing and never reach here.
             */
            const attachEntries = [];
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
                // A refused attach leaves NO managed names behind: the coverage maps
                // describe what THIS attach shadows, so a rollback clears them with it.
                // The LIVE partitions describe disposed fibers after the rollback, so
                // they are cleared too or a later attach's verification would mistake
                // their stale names for a late registration.
                expectedDefinitions.clear();
                managedRealmOf.clear();
                managedPartitions.length = 0;
                attachRecord = null;
            };
            const routedPartitions = managedPartitions;
            for (const [index, mount] of modules.entries()) {
                const binding = observeOnly || mount.toolBindingIdentity === undefined
                    ? undefined
                    : bindingRealmOf(mount.toolBindingIdentity);
                const target = binding?.ctx ?? memberTarget;
                const ownedToolName = binding === undefined ? undefined : toolNameOfBindingIdentity(binding.toolBindingIdentity);
                // BL-17: the target realm's OWN answer; never a `ctx.get('subprocess')`
                // lookup (which would answer the inherited base service).
                const targetFaces = binding === undefined ? installation.members[0]?.faces : binding.faces;
                const targetHasConfinedSubprocess = targetFaces !== undefined && targetFaces.subprocess !== null;
                // BL-18: the target realm's OWN web answer (never `ctx.get('web')`).
                const targetHasConfinedWeb = targetFaces !== undefined && targetFaces.web !== null;
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
                    // or its injected child fiber never becomes eligible to start. The
                    // module context ALSO merges the router's services into every deferred
                    // child's inject (see `routedModuleContext`), which is what lets the
                    // child actually register THROUGH this router instead of failing on
                    // Cordis's isolate-label walk.
                    const moduleCtx = routedModuleContext(routerFiber.ctx);
                    inner = moduleCtx.plugin(mount.module, mount.config);
                    await inner;
                    // SETTLE, THEN INSPECT (the deferred-registration state machine):
                    // wait a bounded number of macrotasks for every descendant fiber to
                    // reach a terminal state, then judge the RESULT — a FAILED child or a
                    // child that never settles is refused; a child that registered is
                    // judged by the partition below. A pending child whose declared
                    // capability is absent everywhere is benign (it never ran).
                    const descendants = windowFibers
                        .filter((created) => created !== routerFiber && isDescendantOf(created, routerFiber) && created.uid !== null);
                    const settled = await settleDeferredRegistrationWindow(descendants, target);
                    // BL-17 (2026-11-04): the PRE-MOUNT check reads the module's declared
                    // `inject`. A module that instead defers `ctx.inject(['subprocess'], …)`
                    // declares it only on the CHILD fiber, so the same refusal is applied
                    // here — still during composition, before this call returns and before
                    // any tool body can run.
                    if (!targetHasConfinedSubprocess) {
                        const deferredProcess = descendants.filter((created) => 'subprocess' in created.inject);
                        if (deferredProcess.length > 0) {
                            throw new TeamServiceInstallError(A5SF_SUBPROCESS_UNCONFINED_REALM, `native tool module '${moduleLabelOf(mount)}' deferred a \`subprocess\` injection`
                                + ` (${deferredProcess.map((created) => `[${Object.keys(created.inject).join(',')}]`).join(', ')}),`
                                + ` but ${realmLabelOf(binding)} mounts no confined subprocess face; refusing at composition time`
                                + ' instead of letting the child resolve the inherited, unconfined base subprocess service');
                        }
                    }
                    // BL-17 (2026-11-05): the same deferred-injection law on the PTY axis
                    // (`旧代 PTY 拒用`). A module that defers `ctx.inject(['terminals'], …)`
                    // would otherwise mount and later resolve the inherited legacy PTY.
                    const deferredTerminal = descendants.filter((created) => 'terminals' in created.inject);
                    if (deferredTerminal.length > 0) {
                        const terminalFaces = binding === undefined ? installation.members[0]?.faces : binding.faces;
                        const terminalAdmitted = terminalFaces !== undefined && terminalFaces.terminals !== null && terminalFaces.terminals !== undefined;
                        if (!terminalAdmitted) {
                            throw new TeamServiceInstallError(A5SF_TERMINALS_LEGACY_PTY_REFUSED, `native tool module '${moduleLabelOf(mount)}' deferred a \`terminals\` injection`
                                + ` (${deferredTerminal.map((created) => `[${Object.keys(created.inject).join(',')}]`).join(', ')}),`
                                + ` but ${realmLabelOf(binding)} mounts no confined terminal face; refusing at composition time`
                                + ' instead of letting the child resolve the inherited, legacy-generation host PTY service');
                        }
                    }
                    // BL-18: the same deferred-injection law on the network axis. A module
                    // that defers `ctx.inject(['web'], …)` would otherwise mount and later
                    // resolve the inherited host web service.
                    if (!targetHasConfinedWeb) {
                        const deferredWeb = descendants.filter((created) => 'web' in created.inject);
                        if (deferredWeb.length > 0) {
                            throw new TeamServiceInstallError(A5SF_NETWORK_UNCONFINED_REALM, `native tool module '${moduleLabelOf(mount)}' deferred a \`web\` injection`
                                + ` (${deferredWeb.map((created) => `[${Object.keys(created.inject).join(',')}]`).join(', ')}),`
                                + ` but ${realmLabelOf(binding)} mounts no confined web face; refusing at composition time`
                                + ' instead of letting the child resolve the inherited, unconfined host web service');
                        }
                    }
                    if (!observeOnly) {
                        // PUBLIC state only: `Fiber.state` is the documented surface, and a
                        // fiber at FAILED says the registration threw without this seam
                        // reaching into the fiber's private error slot (CORE PATCH BUDGET = 0
                        // and AGENTS.md forbid upstream private API). The refusal names the
                        // MODULE, its inject names and the public fiber state — it does NOT
                        // quote the upstream error text, which this seam never reads.
                        const describe = (created) => {
                            const deps = Object.keys(created.inject).join(',');
                            const state = created.state === FIBER_FAILED ? 'failed' : `state ${String(created.state)}`;
                            return `deferred registration ${state}, waiting on [${deps}]`;
                        };
                        if (settled.failed.length > 0) {
                            throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module ${JSON.stringify(mount.toolBindingIdentity ?? null)} started a DEFERRED registration that failed inside the routed mount (${settled.failed.map(describe).join('; ')}); refusing the mount instead of leaving those tools on the unshadowed preset path`);
                        }
                        if (settled.unsettled.length > 0) {
                            throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module ${JSON.stringify(mount.toolBindingIdentity ?? null)} started a DEFERRED registration that did not settle within ${String(DEFERRED_SETTLE_ROUNDS)} macrotasks (${settled.unsettled.map(describe).join('; ')}); refusing the mount instead of hanging on it or accepting a shadow it cannot verify`);
                        }
                    }
                }
                catch (error) {
                    if (typeof detachWindow === 'function')
                        detachWindow();
                    if (fiber !== undefined)
                        await disposeFiberBounded(fiber);
                    await rollbackCreated();
                    // A TYPED refusal thrown by this seam (e.g. the BL-17 unconfined-realm
                    // refusal below) keeps its own code: re-wrapping it as a generic mount
                    // failure would make the one machine-readable fact unreadable.
                    if (error instanceof TeamServiceInstallError)
                        throw error;
                    throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module re-mount failed: ${error instanceof Error ? error.message : String(error)}`);
                }
                if (typeof detachWindow === 'function')
                    detachWindow();
                created.push(fiber);
                if (!observeOnly) {
                    nativeFibers.push(fiber);
                    attachEntries.push({
                        moduleName: String(mount.module?.name ?? `#${String(index)}`),
                        specifier: typeof mount.specifier === 'string' ? mount.specifier : null,
                        allowEmpty: mount.allowEmpty === true,
                        expectedTools: mount.expectedTools === undefined ? [] : [...mount.expectedTools],
                        forwarded: partition.forwarded.size,
                    });
                    for (const [name, definition] of partition.forwardedDefinitions)
                        expectedDefinitions.set(name, definition);
                    // P0: remember which realm owned each covered name so a refusal can
                    // name it (binding identity or ceiling).
                    for (const name of partition.forwarded) {
                        managedRealmOf.set(name, {
                            realm: binding === undefined ? 'ceiling' : 'binding',
                            toolBindingIdentity: binding?.toolBindingIdentity ?? null,
                        });
                    }
                }
                if (!observeOnly) {
                    routedPartitions.push({
                        partition,
                        realm: binding === undefined ? 'ceiling' : 'binding',
                        label: mount.toolBindingIdentity ?? null,
                    });
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
            // COVERAGE OF THE DEFERRED REGISTRATIONS, judged ONCE per attach (never
            // per fiber — a drop is normally delegated to a sibling fiber). Every name
            // the module attempted to register must be FORWARDED by SOME fiber of this
            // call. A name that no fiber forwards was dropped by every router and
            // therefore never got a confined definition: accepting it would leave the
            // preset definition serving the Member with ZERO guard facts — #561's
            // measured leak. Refuse (fail closed), name the names, and roll back.
            const covered = new Set();
            for (const entry of routedPartitions)
                for (const name of entry.partition.forwarded)
                    covered.add(name);
            const uncovered = new Map();
            for (const entry of routedPartitions) {
                for (const name of entry.partition.observed) {
                    if (covered.has(name))
                        continue;
                    if (!uncovered.has(name))
                        uncovered.set(name, entry.label);
                }
            }
            if (uncovered.size > 0) {
                await rollbackCreated();
                throw new TeamServiceInstallError('SERVICE_MOUNT_FAILED', `native tool module ${JSON.stringify([...new Set(uncovered.values())])} registered UNCOVERED name(s) `
                    + `${JSON.stringify([...uncovered.keys()])} through a deferred registration: no fiber of this mount forwards them, `
                    + 'so they would stay on the unshadowed preset definition with zero guard facts; refusing the mount (fail closed)');
            }
            // ASSEMBLY GAP 2: arm re-verification AFTER the last registration, so the
            // mount's own writes cannot be mistaken for a later change.
            // P0 (2026-11-03): arming is fail-closed. If either listener cannot be
            // attached the WHOLE attach is rolled back and refused (typed), instead of
            // running a managed Member on the bounded rounds alone.
            try {
                armVerification(options?.scope);
            }
            catch (error) {
                await rollbackCreated();
                throw error;
            }
            // E8 (2026-11-03): publish the attach record. Only an entry that EXPLICITLY
            // opted out of the empty-frontier refusal (`allowEmpty: true`) AND
            // forwarded nothing is an acknowledgement; its declared `expectedTools`
            // names travel with it as ACKNOWLEDGED (unshadowed, unverified) names, so
            // the record can never be read as a verification.
            const acknowledgedEntries = attachEntries.filter((entry) => entry.allowEmpty && entry.forwarded === 0);
            attachRecord = Object.freeze({
                schema: 'a5sf-native-attach/1',
                emptyFrontierAcknowledged: acknowledgedEntries.length > 0,
                emptyFrontierModules: Object.freeze([...new Set(acknowledgedEntries.map((entry) => entry.moduleName))]),
                emptyFrontierSpecifiers: Object.freeze([
                    ...new Set(acknowledgedEntries
                        .map((entry) => entry.specifier)
                        .filter((specifier) => specifier !== null)),
                ]),
                acknowledgedNames: Object.freeze([...new Set(acknowledgedEntries.flatMap((entry) => [...entry.expectedTools]))]),
            });
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
                    detachAdmission();
                }
                catch {
                    // Same rule as the verification disposer above.
                }
                detachAdmission = undefined;
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