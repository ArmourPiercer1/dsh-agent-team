/**
 * Alpha.5 PR1 (plan §4) — the ASSEMBLY INSTALL of the closed-world Guard and
 * the Stable Scoped Dispatcher on one Team Agent's public seams.
 *
 * WHY THIS FILE EXISTS (design §4.1 PREPARING, verbatim order):
 *
 *     1. install the closed-world Guard            (`tools.guard`, monotonic)
 *     2. mask the inherited names to be taken over (`tools.restrict`)
 *     3. register the STABLE Dispatcher Definition (`tools.register`)
 *     4. validate presets / MCP / scope / output / Provider capabilities
 *     5. PUBLISH (PREPARING → ACTIVE)
 *
 * Any failure before (5) means the Agent is NOT published — the AgentSetup
 * contract already rolls an unpublished agent back, and the Guard installed
 * in (1) refuses everything while the state is not ACTIVE, so a half-built
 * assembly is never a runnable Agent.
 *
 * THE ORDER IS THE SECURITY PROPERTY, and the disposer preserves it in
 * reverse-minus-the-Guard (NEG-1, the PoC's `L3-hazard` leg): the host's
 * teardown habit is "lift the restriction, then drop the listener", and that
 * order lets the ToolRuntime's late dispatch re-resolution fall back to the
 * NATIVE BODY (the PoC measured it: 原体 ran once). Here the composite
 * disposer therefore:
 *
 *     beginDrain()            → new calls refused, in-flight cancellation
 *     (no restrict lift)      → the mask STAYS for the whole drain
 *     wait for the self-count → only then tombstone()
 *     tombstone()             → late callbacks keep meeting the same refusal
 *     release()               → refuses while a self-counted lease is open
 *     only at RELEASED        → the mask may lift, and the Guard goes last
 *
 * The Guard is the LAST thing removed and the FIRST thing installed. A host
 * that never lets the count reach zero keeps the mask and the Guard forever
 * — a leaked mask is a resource problem; a lifted mask is a safety problem.
 *
 * FAIL-CLOSED SERVICES (plan §4 "缺少必需 Service 时不接受 Cordis Fiber 静默
 * PENDING 当作已完成装配"): {@link requireService} turns "the service is
 * absent / malformed" into a typed assembly failure rather than a fiber that
 * merely sits PENDING (NEG-8 in the PoC: a missing service surfaces as
 * PENDING with an EMPTY tool surface, which looks like a successful mount
 * from outside).
 *
 * What it touches upstream, all PUBLIC: `agentCtx.tools.guard`,
 * `agentCtx.tools.schemas(scope)`, `agentCtx.on('tools/change')` (diagnostics
 * only — see {@link ScopedDispatcher.revalidateSurface}), and the
 * {@link MaskPort} the caller already owns (`applyBuiltInToolDeny`). It never
 * reaches into a registry, never imports a private module, never mutates the
 * global layer.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch/install
 */
import { untestedAssurance } from './closed-world-guard.js';
import { createPendingCallLedger } from './pending-calls.js';
import { createScopedDispatcher, } from './scoped-dispatcher.js';
/**
 * A stable, content-free identity for one live definition Body.
 *
 * The Guard may not compare function SOURCE (that leaks implementation into
 * evidence and is spoofable by re-stringifying), and it may not read a clock.
 * What it CAN do — and what the pinned Host makes possible — is hold a
 * WeakMap from the function object itself to an id this process minted: two
 * reads of the same registered Body return the same id, and a re-registration
 * hands back a different function object, therefore a different id. Nothing
 * observable about the Body is retained, and the entry dies with the function.
 */
const definitionIds = new WeakMap();
let definitionIdCounter = 0;
function definitionFingerprint(target) {
    if (target === null || (typeof target !== 'object' && typeof target !== 'function'))
        return null;
    const existing = definitionIds.get(target);
    if (existing !== undefined)
        return existing;
    definitionIdCounter += 1;
    const id = `def#${definitionIdCounter}`;
    definitionIds.set(target, id);
    return id;
}
/**
 * THE PROVIDER SIDE OF THE SAME IDENTITY LAW (pb §6 binding feed). An
 * assembly that PLACES a Definition holds the very object it registered;
 * this is how it records that placement's identity in the SAME algebra the
 * Guard compares against at every call. It is the only way a provider can
 * say "the Body I reviewed and placed is THIS Body" without stringifying
 * the Body (which leaks and is spoofable by re-stringifying) and without
 * reading a clock (which this lane never does).
 */
export function definitionIdentityOf(target) {
    if (target === null || (typeof target !== 'object' && typeof target !== 'function'))
        return null;
    const body = target.execute;
    return definitionFingerprint(typeof body === 'function' ? body : target);
}
/**
 * Map one host `ToolExecution` (the pinned `ToolGuard` parameter) to the
 * host-neutral {@link GuardExecView}. The identity facts the Guard verifies
 * are exactly what the public execution object exposes: the calling `Agent`
 * (the registry's own scope routing key) through its Agent id, else its
 * durable session header id. A tool name is never an identity, and an exec
 * with NO identity is not an anonymous pass (NEG-2: a Team-origin dispatch
 * that lost its Agent is refused, not laundered into the global lane).
 */
export function hostExecToView(exec) {
    const raw = exec;
    const name = typeof raw?.name === 'string' ? raw.name : String(raw?.name ?? '');
    const agentId = typeof raw?.agent?.id === 'string' ? raw.agent.id : undefined;
    const headerId = typeof raw?.agent?.session?.header?.id === 'string' ? raw.agent.session.header.id : undefined;
    const identity = agentId ?? headerId;
    return identity === undefined ? { name } : { name, agentIdentity: identity };
}
const fail = (code, message) => ({
    ok: false,
    error: { code, message },
});
/**
 * The required-Service check that replaces the silent `PENDING` (plan §4).
 * A Cordis fiber whose service is absent does not throw at mount: it sits
 * PENDING and the tool surface simply comes back EMPTY (PoC NEG-8), so the
 * assembly must ask for each dependency explicitly and fail loudly.
 */
export function requireService(value, what, predicate = (v) => v !== undefined && v !== null) {
    if (value === undefined || value === null || !predicate(value)) {
        return fail('IO_POLICY_UNSUPPORTED', `assembly requires the public service "${what}" and it is absent or malformed (a silently PENDING fiber is not an assembled dependency)`);
    }
    return { ok: true, value: value };
}
/** Read the agent-scoped surface through `tools.schemas(scope)` (fail closed). */
function readSurface(ctx, runtimeAgent) {
    const schemas = requireService(ctx.tools.schemas, 'tools.schemas', (fn) => typeof fn === 'function');
    if (!schemas.ok)
        return schemas;
    if (runtimeAgent === undefined || runtimeAgent === null) {
        return fail('TOOL_BINDING_UNVERIFIED', 'no runtime Agent identity: the agent-scoped tool surface is unreadable (the global surface is never a substitute)');
    }
    let raw;
    try {
        raw = schemas.value.call(ctx.tools, runtimeAgent);
    }
    catch (error) {
        return fail('TOOL_BINDING_UNVERIFIED', `tools.schemas(scope) threw: ${String(error?.message ?? error)}`);
    }
    if (!Array.isArray(raw))
        return fail('TOOL_BINDING_UNVERIFIED', 'tools.schemas returned a non-array surface');
    const names = [];
    for (const entry of raw) {
        const name = entry?.name;
        if (typeof name !== 'string' || name.length === 0) {
            return fail('TOOL_BINDING_UNVERIFIED', 'tools.schemas returned a schema without a string name');
        }
        names.push(name);
    }
    return { ok: true, value: names.sort() };
}
/**
 * Install the Guard + Dispatcher on ONE Team Agent scope (design §4.1
 * PREPARING steps 1 and 3; the caller performs step 2 between them).
 *
 * The returned handle starts in PREPARING — the Guard is ALREADY armed and
 * already refusing while the caller finishes the assembly (mask, own-layer
 * registrations, MCP, capability validation). {@link
 * ScopedGuardHandle.publish} is the only door to ACTIVE.
 */
export function installScopedToolGuard(input) {
    const observations = [];
    const observe = (row) => {
        if (observations.length < 2000)
            observations.push(row);
        input.onObserve?.(row);
    };
    const guardSeam = requireService(input.agentCtx.tools.guard, 'tools.guard', (fn) => typeof fn === 'function');
    if (!guardSeam.ok) {
        observe({ event: 'guard-install-refused', code: guardSeam.error.code });
        return guardSeam;
    }
    // THE DEFINITION SEAM IS REQUIRED (PR1 Gate R2). A Guard that can only see
    // NAMES verifies names, and a name is not a Body: the same Scope and the same
    // name can be re-registered over a different implementation, and the old
    // verified Binding would keep waving it through. `tools.get` is the one public
    // seam that answers "which Body does this name resolve to right now", so its
    // absence is recorded as a PUBLIC-seam gap and the assembly REFUSES rather
    // than publishing a Guard that cannot re-verify anything.
    //
    // PUBLIC-SEAM GAP (PoC-1 format), recorded rather than papered over:
    //   seam asked for        : tools.get(name, scope) → the live ToolDefinition
    //   what it gives         : the definition object, so `definition.execute`
    //                           is a function identity this process can pin
    //   what it does NOT give : any provenance field — no owner, no contributing
    //                           package, no "is native" bit (schemas() whitelists
    //                           name/description/parameters only, and register()
    //                           records no public owner)
    //   consequence           : native-vs-third-party attribution is NOT
    //                           derivable at a public seam, so the assembly
    //                           carries an explicit trusted native list
    //                           (`nativeNames`, from the public GLOBAL view) and
    //                           pins every inherited definition by identity;
    //                           anything not pinned is refused, never assumed.
    const definitionSeam = requireService(input.agentCtx.tools.get, 'tools.get', (fn) => typeof fn === 'function');
    if (!definitionSeam.ok) {
        observe({
            event: 'public-seam-gap',
            seam: 'tools.get',
            fatal: true,
            detail: 'no public seam resolves which ToolDefinition a name currently executes, so a verified Binding could not be re-verified at dispatch; the assembly refuses instead of assuming no change',
        });
        return fail('IO_POLICY_UNSUPPORTED', `assembly requires the public seam "tools.get" and it is absent: without it the closed world cannot tell a re-bound Body from the one its Binding pinned (a Guard that cannot re-verify is not a closed world)`);
    }
    /**
     * The tools service, captured HERE — inside the assembly's own context.
     * A Cordis agent-scope ctx is a proxy: reading an injected service from it
     * outside an inject context throws (`cannot get property "tools" without
     * inject`), and this read happens on EVERY guarded call. So the service
     * object is resolved once, while the assembly still may, and the captured
     * reference is what the per-call reads use.
     */
    const toolsService = input.agentCtx.tools;
    /** Read what one name resolves to RIGHT NOW, as a content-free identity. */
    const readDefinition = (name) => {
        let definition;
        try {
            definition = definitionSeam.value.call(toolsService, name, input.runtimeAgent);
        }
        catch (error) {
            return { ok: false, detail: `tools.get("${name}") threw: ${String(error?.message ?? error)}` };
        }
        if (definition === undefined || definition === null) {
            return { ok: false, detail: `tools.get("${name}") resolved to no definition on this scope` };
        }
        const body = definition.execute;
        const id = definitionFingerprint(typeof body === 'function' ? body : definition);
        return id === null
            ? { ok: false, detail: `tools.get("${name}") returned a definition with no pinnable Body` }
            : { ok: true, fingerprint: id };
    };
    /**
     * THE TRUSTED SIDE OF THE SAME PUBLIC SEAM (residual R-a).
     *
     * `tools.get(name)` with NO scope is the registry's GLOBAL view — the very
     * view `nativeNames` was read out of, so it is the one reading the assembly is
     * entitled to trust as "what DSH ships". `tools.get(name, scope)` is what THIS
     * Agent resolves, and the pinned `view()` puts the scope's own registrations
     * LAST: "shadowing an inherited name and outside the filter above".
     *
     * Comparing the two is the whole of R-a. A name on the trusted list whose two
     * reads disagree is not native for this Agent — somebody else's Definition is
     * answering that name here — and an ordinary third-party row or MCP bridge gets
     * into exactly that shape by following the Host's own advice for a per-agent
     * variant. Neither read is privileged over the other for any OTHER purpose;
     * for native standing, agreement is the price.
     */
    const readTrustedDefinition = (name) => {
        let definition;
        try {
            definition = definitionSeam.value.call(toolsService, name);
        }
        catch (error) {
            return { ok: false, detail: `tools.get("${name}") (global view) threw: ${String(error?.message ?? error)}` };
        }
        if (definition === undefined || definition === null) {
            return { ok: false, detail: `tools.get("${name}") (global view) resolved to no definition` };
        }
        const body = definition.execute;
        const id = definitionFingerprint(typeof body === 'function' ? body : definition);
        return id === null
            ? { ok: false, detail: `tools.get("${name}") (global view) returned a definition with no pinnable Body` }
            : { ok: true, fingerprint: id };
    };
    /**
     * The B3 ledger: calls that have passed the dispatch door and have not reached
     * a settled edge. `tools/change` consults it, the door arms it, and the settled
     * edge drains it. It holds no permission and decides nothing on its own: it
     * records WHICH call was validated against WHICH definition identity, which is
     * the only thing that turns an unfiltered `tools/change` into a targeted
     * cancellation instead of a shotgun.
     */
    const pendingCalls = createPendingCallLedger();
    /**
     * The change channel's own status, as an auditable fact rather than a hope.
     * `armed` = subscribed and the mechanism is in force; `proven` = at least one
     * notification has actually been delivered on this Host. The distinction
     * matters because a subscription that is accepted and never delivered is
     * invisible at assembly time, and a lane that claims an abort guarantee it has
     * never seen fire would be repeating PR1's mistake in new words.
     */
    let changeChannel = 'armed';
    const dispatcher = createScopedDispatcher({
        agentScopeKey: input.agentScopeKey,
        trustedIdentities: input.trustedIdentities,
        resolveDefinition: readDefinition,
        ...(input.nativeNames === undefined ? {} : { nativeNames: input.nativeNames }),
        ...(input.policyGeneration === undefined ? {} : { policyGeneration: input.policyGeneration }),
        ...(input.authorityGeneration === undefined ? {} : { authorityGeneration: input.authorityGeneration }),
        ...(input.nativeProviderId === undefined ? {} : { nativeProviderId: input.nativeProviderId }),
        onObserve: observe,
    });
    const begin = dispatcher.beginAssembly();
    if (!begin.ok)
        return begin;
    // STEP 1 — the Guard goes in FIRST, before any mask and before any
    // own-layer registration. Its disposer is captured, never discarded.
    /**
     * The identity a lease is held under. `ToolExecution.callId` is the registry's
     * own per-call identity; a call that somehow arrives without one gets a
     * name-scoped synthetic id rather than a shared empty key, so a missing id can
     * never make two calls share (or erase) one lease.
     */
    const callIdOf = (exec) => {
        const view = exec;
        return typeof view?.callId === 'string' && view.callId.length > 0 ? view.callId : `anonymous:${String(view?.name)}`;
    };
    let guardDispose;
    try {
        guardDispose = guardSeam.value.call(input.agentCtx.tools, (exec) => {
            const denial = dispatcher.guard(hostExecToView(exec));
            if (denial !== undefined) {
                // MEASURED on the pinned registry: the Guard stage can also be met
                // MID-DISPATCH (a call parked at `pre-execute` re-meets it when it
                // resumes), so a refusal here is the same provable fact as a refusal at
                // either gate — this call's Body never ran. Ending its lease is our act,
                // not host evidence, and without it a refused call would be the reason
                // a teardown could never finish.
                dispatcher.endCallById(callIdOf(exec), 'refused');
            }
            return denial;
        });
    }
    catch (error) {
        dispatcher.failAssembly(`tools.guard threw: ${String(error?.message ?? error)}`);
        return fail('TOOL_BINDING_UNVERIFIED', `the tools.guard seam rejected the closed-world Guard: ${String(error?.message ?? error)}`);
    }
    observe({ event: 'guard-installed', scope: input.agentScopeKey, maskedNames: input.maskedNames ?? [] });
    // Everything this install registers beyond the Guard (the diagnostics
    // listener and the gates). They go with the Guard, at the end — and on a
    // failed assembly, IMMEDIATELY, so nothing stays armed on a surface the
    // assembly is not going to publish (PR1 Gate R3).
    const extraDisposers = [];
    /** Undo EVERYTHING this install put on the ctx: no half-armed residue. */
    const unarmAll = () => {
        for (const off of extraDisposers.splice(0)) {
            try {
                off();
            }
            catch {
                /* an already-off listener is not a safety change */
            }
        }
        if (typeof guardDispose === 'function') {
            try {
                guardDispose();
            }
            catch {
                /* an already-disposed scope is not a safety change */
            }
        }
        for (const seam of dispatcher.seamsArmed())
            dispatcher.disarmSeam(seam);
    };
    /**
     * A failed assembly is a REFUSAL with the ctx left clean, not a degraded
     * Guard. `PREPARING → UNBOUND` is the only back-edge (PR0's table) and the
     * caller must not publish on this handle.
     */
    const assemblyFailed = (code, message) => {
        unarmAll();
        dispatcher.failAssembly(message);
        observe({ event: 'assembly-failed', code, detail: message, published: false, residue: 'none' });
        return fail(code, message);
    };
    // `tools/change` — DIAGNOSTICS ONLY. The host fires it for every register /
    // unregister / restriction change (and a scoped listener sees changes
    // beyond its own scope), so it is the right place to re-read and re-report
    // the surface; it is the wrong place to decide anything, because a
    // registration event arrives AFTER the name is already dispatchable
    // (design §4.1: tools/change 用于无权限的重新校验/诊断，不代替执行时检查).
    const revalidate = () => {
        const current = readSurface(input.agentCtx, input.runtimeAgent);
        if (!current.ok) {
            observe({ event: 'surface-revalidate-unavailable', detail: current.error.message });
            return { added: [], removed: [], denied: [], drifted: [] };
        }
        // The revalidation is not a name diff. Names that are still there may have
        // had their DEFINITION swapped under us, and a name-only comparison cannot
        // see that (PR1 Gate R2: the old code's diff was a no-op for exactly the
        // hazard it claimed to watch). So the current fingerprints go in, and any
        // mismatch is revised down to unverified.
        const identities = {};
        for (const name of current.value) {
            const probe = readDefinition(name);
            if (probe.ok)
                identities[name] = probe.fingerprint;
        }
        const diff = dispatcher.revalidateSurface(current.value, identities);
        return { added: diff.added, removed: diff.removed, denied: [...diff.added, ...diff.drifted], drifted: diff.drifted };
    };
    /**
     * Register a listener under a STABLE FUNCTION NAME. Three lanes now sit on
     * the same waterfalls (the alpha.2 permission adapter, the alpha.5 Guard),
     * and a reviewer inspecting a live ctx — or a test that must count one lane
     * without blind-bumping the other's pin — needs a name, not an anonymous
     * arrow. The wrapper costs nothing and changes no behaviour.
     */
    const named = (name, fn) => Object.defineProperty(fn, 'name', { value: name, configurable: true });
    // THE FIVE SEAMS, doing three different jobs — and the split is FORCED by
    // measured host facts, not by taste.
    //
    // MEASURED on the pinned 0.2.0-rc.2 registry, with a park that provably holds
    // the Body open (`tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs`,
    // NEG1-SEAM / NEG1-R4):
    //
    //   begin   ── `tools/pre-execute`  `next()` resolves BEFORE the Body is entered
    //   —       ── `tools/execute`      `next()` resolves after the Body is ENTERED,
    //                                   while it is still running
    //   result  ── `tools/post-execute` fires with the projected result in hand,
    //                                   AFTER the Body returned — and it is the
    //                                   result a POST-EXECUTE policy may still
    //                                   reshape, so it is not the final outcome
    //   settled ── `tools/result`       the registry's final EMIT edge: dispatched
    //                                   from `finishScheduledExecution` →
    //                                   `notifyResult` after materialization and
    //                                   content finalization, on the success AND
    //                                   the error path (`packages/core/tools/src/
    //                                   index.ts`)
    //
    // A correction is on the record: an earlier revision of this file (and of the
    // kit) claimed `post-execute` was NOT provably after the Body returned, and
    // released the lease there as the best available approximation. That claim
    // came from a measurement whose park did not hold the Body open, so it proved
    // nothing; PR1 Gate R4 required it re-measured. The measured order is above.
    // The law is therefore: a lease is taken at the OUTERMOST door
    // (`pre-execute`, the first door every call passes, including one the Guard
    // turns away) and ENDED at `tools/result` — the last edge, the one the
    // registry guarantees after the outcome is final. `tools/post-execute` only
    // RECORDS that a result exists, because "a result exists" is a fact about the
    // pipeline, not a promise that the Body is finished or that the outcome can no
    // longer be rewritten by a later listener.
    //
    // Why the lease must start at the OUTERMOST door: the NEG-1 window is a call
    // parked at `pre-execute` while the teardown runs. Leased there, the drain
    // sees it and cannot reach RELEASED — so the mask is still down and the
    // Guard is still armed when the call resumes, and it meets a refusal instead
    // of a re-resolved native Definition.
    //
    // And every seam here is REQUIRED: a registration that throws, or an ctx with
    // no event-registration function at all, is an ASSEMBLY FAILURE. The Guard is
    // un-armed again and the caller is handed a typed refusal, because a Guard
    // missing one door is not a smaller closed world — it is an open one that
    // says "closed".
    const onSeam = requireService(input.agentCtx.on, 'the agent event registration seam (ctx.on)', (fn) => typeof fn === 'function');
    if (!onSeam.ok) {
        return assemblyFailed('IO_POLICY_UNSUPPORTED', `cannot arm the required public seam "tools/pre-execute": ${onSeam.error.message} — without the outer door a call parked there could resume into a re-resolved Definition (the NEG-1 hazard itself)`);
    }
    const onEvent = onSeam.value;
    const refuse = (edge, exec) => {
        const view = exec;
        throw new Error(`team tool guard: "${String(view?.name)}" reached the ${edge} stage while this Agent's Tool Dispatcher is ${dispatcher.state()} (not ACTIVE); the body is not reachable`);
    };
    /** Arm one required seam, or fail the whole assembly with nothing left on the ctx. */
    const armRequiredSeam = (seam, event, listener, why) => {
        try {
            extraDisposers.push(onEvent(event, named(seam, listener)));
            dispatcher.armSeam(event);
            return { ok: true, value: undefined };
        }
        catch (error) {
            return assemblyFailed('IO_POLICY_UNSUPPORTED', `cannot arm the required public seam "${event}" (${why}): ${String(error?.message ?? error)}`);
        }
    };
    /**
     * What actually happened to a call this lane was watching, read off the
     * Host's OWN two cancellation shapes and nothing else. The pinned registry
     * distinguishes the two cases the lane must never conflate
     * (`packages/core/tools/src/index.ts` @ 639ed01539):
     *
     *   `ABORTED_BEFORE_DISPATCH` (`:486`, `:1971-1982`) — cancellation PREVENTED
     *       the Body's invocation; `state.bodyInvoked` (`:1580`) was never set and
     *       `resolveExecution` (`:1578`) was never reached. The only case in which
     *       this lane may say a call did not execute.
     *   `ABORTED` (`:483`, `:1958-1969`) — cancellation SUPERSEDED SUCCESS AFTER
     *       BODY INVOCATION. The Body ran; its side effects are real and its own
     *       result is preserved in `additionalContexts`. A call in this class is
     *       reported as TERMINATED, never as cancelled, and never as un-executed.
     *
     * Anything else is an ordinary outcome: the Body ran (or the pipeline failed
     * for its own reason), and if a cancellation had been issued it arrived too
     * late — which is its own loud fact, not a silent one.
     */
    const classifyOutcome = (callId, name, abortedByLane, result) => {
        const code = result?.error?.info?.code;
        const failed = result?.isError === true;
        const outcome = code === 'ABORTED_BEFORE_DISPATCH'
            ? 'cancelled-before-body'
            : code === 'ABORTED'
                ? 'terminated-after-body-start'
                // The lane raised a cancellation and the pipeline came back FAILED with
                // no outcome code to read. Claiming "the Body ran" would be invention,
                // and claiming "it never ran" is exactly the false negative this whole
                // mechanism exists to prevent — so the lane declines to say either.
                // (This is not hypothetical: an early revision of the kit's own
                // post-execute observer returned `undefined` from a WATERFALL edge and
                // the registry answered with its own internal TypeError. The alarm is
                // what turns that class of hole into a visible fact.)
                : abortedByLane && (failed || code !== undefined)
                    ? 'outcome-unreadable'
                    : 'completed';
        if (outcome === 'outcome-unreadable') {
            observe({
                event: 'dispatcher-call-outcome-unreadable',
                severity: 'alarm',
                callId,
                tool: name,
                ...(code !== undefined ? { observedCode: String(code) } : {}),
                note: 'the lane had raised a cancellation for this call and cannot read the registry\'s own outcome code, so it reports NEITHER "cancelled before the Body" NOR "executed": an unresolved call is left standing as unresolved',
            });
            return;
        }
        if (outcome === 'terminated-after-body-start') {
            observe({
                event: 'dispatcher-call-terminated-after-body-start',
                callId,
                tool: name,
                sideEffectPossible: true,
                ...(abortedByLane ? { abortIssuedBy: 'lane-definition-move' } : { abortIssuedBy: 'none' }),
                note: 'the Body was invoked, so this call is NOT reported as un-executed: a cancellation that arrives after the Body started can only stop what follows it',
            });
            return;
        }
        if (outcome === 'cancelled-before-body') {
            observe({
                event: abortedByLane ? 'dispatcher-call-cancelled-before-body' : 'dispatcher-call-cancelled-by-others',
                callId,
                tool: name,
                ...(abortedByLane
                    ? { note: 'the lane raised this cancellation because the validated Definition moved; the registry resolved no Body and invoked none' }
                    : { note: 'the registry reports a before-dispatch cancellation this lane did not issue (a caller cancel or an outer wrapper)' }),
            });
            return;
        }
        // The call completed. If a cancellation had been issued for it, it lost the
        // race: the Body ran anyway and the lane says so out loud.
        if (abortedByLane) {
            observe({
                event: 'dispatcher-call-completed-after-abort',
                callId,
                tool: name,
                sideEffectPossible: true,
                detail: 'the lane raised a cancellation the registry never saw before dispatch, and the Body ran to an ordinary outcome; this call is reported as EXECUTED',
            });
        }
    };
    // 1/5 — the outer door: refuse while not ACTIVE, otherwise take the lease.
    const armedPreExecute = armRequiredSeam('a5p1GuardPreExecuteGate', 'tools/pre-execute', ((exec, next) => {
        if (!dispatcher.active()) {
            // We are refusing this call ourselves: its Body provably never ran, so
            // its lease ends here in any state — a call we turned away must never
            // be the reason a teardown cannot finish.
            dispatcher.endCallById(callIdOf(exec), 'refused');
            refuse('pre-execute', exec);
        }
        const begun = dispatcher.beginCall(callIdOf(exec), String(exec?.name));
        if (!begun.ok)
            throw new Error(begun.error.message);
        return next();
    }), 'without the outer door a parked call could resume into a re-resolved Definition');
    if (!armedPreExecute.ok)
        return armedPreExecute;
    // 2/5 — the result edge: a result EXISTS, which is recorded and is not proof.
    // The lease deliberately survives this edge (PR1 Gate R4).
    const armedPostExecute = armRequiredSeam('a5p1GuardResultEdge', 'tools/post-execute', ((exec, _result, next) => {
        dispatcher.noteResultObserved(callIdOf(exec));
        return next();
    }), 'without it the assembly cannot even tell that a call produced a result');
    if (!armedPostExecute.ok)
        return armedPostExecute;
    // 3/5 — the settled edge: the Body returned. This is where a lease ends, and
    // (residual R-b) where a Definition that moved DURING the call is caught. The
    // registry resolves the Body inside its own dispatch step, after every seam
    // this lane owns, so a legal re-registration in that last gap cannot be
    // refused before it runs — the seam gap is recorded in PoC-1 form in the
    // PR1-residual §12. What the lane CAN do, and does here, is refuse it at the
    // earliest moment it is observable: this call's own settled edge withdraws the
    // verification, so the exposure is exactly one call and never a standing state.
    const armedResultSettled = armRequiredSeam('a5p1GuardResultSettledEdge', 'tools/result', ((exec, result) => {
        // A call this Dispatcher never leased (a Guard refusal, a call from
        // before assembly) has nothing to end, and that is not an anomaly.
        // A call it DID lease, arriving after the drain began, is refused as
        // evidence and recorded by the Dispatcher itself.
        const callId = callIdOf(exec);
        const ended = dispatcher.endCallById(callId);
        const watch = pendingCalls.settle(callId);
        if (ended.ended) {
            dispatcher.noteCallEdgeDefinition(String(exec?.name));
        }
        if (watch !== undefined) {
            const name = String(exec?.name);
            classifyOutcome(callId, name, watch.abortedByLane, result);
            // The one case the abort could not cover, said out loud instead of filed
            // as a withdrawal: this call carried a watch, the lane was NEVER told the
            // Definition had moved, and the Body was reached anyway. On this Host that
            // means the notification channel was accepted and silent — a configuration
            // no assembly-time check can see, and exactly the one a claim of "closed"
            // must never be built on.
            if (!watch.abortedByLane) {
                const now = readDefinition(name);
                if (now.ok && now.fingerprint !== watch.record.pinnedIdentity) {
                    observe({
                        event: 'dispatcher-call-executed-unvalidated',
                        callId,
                        tool: name,
                        pinned: watch.record.pinnedIdentity,
                        current: now.fingerprint,
                        changeChannel: changeChannel,
                        severity: 'alarm',
                        detail: 'a Definition this lane had validated moved while the call was in flight and no tools/change notification arrived, so nothing cancelled it before its Body; the verification is withdrawn at this edge, and an assembly whose channel stays like this is not a closed world — it is one that has not been shown to be',
                    });
                }
            }
        }
    }), 'without the settled edge no lease can ever end, so no teardown could ever be confirmed');
    if (!armedResultSettled.ok)
        return armedResultSettled;
    // 4/5 — the dispatch gate: the door NEAREST THE BODY. Two questions are asked
    // here, and PR1 asked only the first.
    //   (a) is this Dispatcher still ACTIVE (a call racing the teardown is turned
    //       away before its Body);
    //   (b) does the name STILL resolve to the Definition its Binding pinned
    //       (residual R-b). The pinned registry asks the Guard stage AFTER
    //       `pre-execute` and resolves the Body LAST, inside its own dispatch step
    //       — so every seam this lane owns sits before that resolution, and a
    //       LEGAL re-registration landing between the Guard and this door would
    //       otherwise put a Body on the wire that no decision ever validated.
    //       Re-asking the whole closed-world question here is what makes the door
    //       nearest the Body re-verify what the outer door verified. The residual
    //       window this still cannot see (a re-registration in a listener mounted
    //       AFTER this one, before the registry's own resolution) is recorded in
    //       the PR1-residual §12 in PoC-1 form, and closed as far as a public seam
    //       allows by `noteCallEdgeDefinition` at the settled edge below.
    /**
     * Put a cancellable signal on this call and take the watch that goes with it.
     *
     * The contract being used, verbatim from the pinned `tools/execute` declaration
     * (`index.ts:155-159`): "wrappers may change only `exec.signal`, while call
     * identity remains immutable. The registry re-fuses the original caller signal
     * before the body, so replacement cannot detach caller cancellation; wrappers
     * must still restore their signal and reach quiescence." Three obligations
     * follow, and all three are honoured here:
     *
     *  1. ONLY `exec.signal` is touched — no veto, the native execute chain runs;
     *  2. the signal that was already there (an outer wrapper's deadline, e.g. the
     *     Host's own timeout policy) is FORWARDED into ours, so replacing it never
     *     silently disarms somebody else's cancellation — and since A5-CAUSE the
     *     forwarding carries the abort CAUSE verbatim (repair ticket
     *     `repair-ticket-install-signal-cause.md`): whatever `incoming.reason` is
     *     (a host `AgentCancelCause`, a timeout DOMException, nothing) is what
     *     ours aborts with, because a Definition's own closed laws read the cause
     *     off the signal they are handed, and a marker of ours in that seat is a
     *     fact this lane invented;
     *  3. the original signal is restored on the way out, and the watch is dropped
     *     at the settled edge — quiescence, not a leaked controller.
     *
     * If the write does not take effect the lane cannot make its promise at all,
     * and the call is refused rather than run unguarded.
     */
    const armWrapperSignal = (exec, record) => {
        const holder = exec;
        const incoming = holder.signal;
        const ours = record.controller.signal;
        const forward = () => {
            if (record.state === 'watched') {
                try {
                    // A5-CAUSE (repair-ticket-install-signal-cause.md): relay the CAUSE
                    // we were given, verbatim — the same law the Host's own fuse applies
                    // (`abortFrom` forwards `source.reason`, tools/lib @639ed01539
                    // :3652-3656). `abort(reason)` carries the reason object (Node
                    // >=17.3), so an incoming `{kind:'user'}` reaches the Definition as
                    // THAT object; a reason-less abort lands on a plain AbortError,
                    // never on a marker of ours — the measured failure of the pre-fix
                    // byte was exactly a marker replacing the caller's cause, which the
                    // row's closed cancelled law then correctly (and correctly visibly)
                    // refused (DIAGNOSIS §②③, three independent runs).
                    record.controller.abort(incoming?.reason ?? new DOMException('inherited-signal', 'AbortError'));
                }
                catch {
                    // The relay is best-effort: a controller that refused this reason
                    // call still has its cancellation reached by the registry's own
                    // re-fused caller signal (`:155-159`), so forwarding never holds
                    // the stop mechanism hostage to the cause object.
                }
            }
        };
        let listening = false;
        if (typeof incoming?.addEventListener === 'function') {
            try {
                incoming.addEventListener('abort', forward, { once: true });
                listening = true;
            }
            catch {
                // A signal that refuses a listener is still forwarded by the registry,
                // which fuses the CALLER's signal itself; nothing of ours is lost.
            }
        }
        if (incoming?.aborted === true)
            forward();
        try {
            holder.signal = ours;
        }
        catch (error) {
            if (listening)
                incoming?.removeEventListener?.('abort', forward);
            return { ok: false, detail: `writing exec.signal threw: ${String(error?.message ?? error)}` };
        }
        if (holder.signal !== ours) {
            if (listening)
                incoming?.removeEventListener?.('abort', forward);
            holder.signal = incoming;
            return { ok: false, detail: 'exec.signal did not retain the wrapper signal (the execution object will not carry a wrapper)' };
        }
        return {
            ok: true,
            restore: () => {
                if (listening)
                    incoming?.removeEventListener?.('abort', forward);
                try {
                    holder.signal = incoming;
                }
                catch {
                    // The registry restores what it saw at entry in its own `finally`
                    // (`:1589-1590`); a failed restore here is reported by that path.
                }
            },
        };
    };
    const armedExecute = armRequiredSeam('a5p1GuardDispatchGate', 'tools/execute', (async (exec, next) => {
        if (!dispatcher.active()) {
            // This call is turned away before its Body: its lease ends here, by us,
            // because we know it will never run.
            dispatcher.endCallById(callIdOf(exec), 'refused');
            refuse('execute', exec);
        }
        const doorDenial = dispatcher.guard(hostExecToView(exec));
        if (doorDenial !== undefined) {
            // Same reasoning as above: the Body is provably unreachable from here,
            // so the lease ends at the door that refused it.
            dispatcher.endCallById(callIdOf(exec), 'refused');
            throw new Error(`${doorDenial} [refused at the dispatch door, the stage nearest the Body]`);
        }
        // B3: the door is not only the last CHECK before the Body, it is now also
        // the place a call becomes CANCELLABLE. The registry resolves this call's
        // Definition after every listener (`:1578`) and refuses it on a raised
        // signal one step earlier (`:1572`, before resolution), so a signal handed
        // over here reaches a gap no check of ours can. The identity put on the
        // watch is the one the guard above just re-verified, so the watch means
        // "this call was validated against THIS Body".
        const callId = callIdOf(exec);
        const name = String(exec?.name);
        const pinned = readDefinition(name);
        if (!pinned.ok) {
            dispatcher.endCallById(callId, 'refused');
            throw new Error(`team tool guard: "${name}" cannot be made cancellable at the dispatch door: its definition became unreadable (${pinned.detail}); a call this lane cannot re-verify is not a call it may let through [refused at the dispatch door, the stage nearest the Body]`);
        }
        const { record, reentry } = pendingCalls.arm({
            callId,
            scopeKey: input.agentScopeKey,
            name,
            pinnedIdentity: pinned.fingerprint,
        });
        if (reentry && record.pinnedIdentity !== pinned.fingerprint) {
            // Two doors, two different Bodies under one call id: the honest reading
            // is that this call is not the one that was validated.
            dispatcher.endCallById(callId, 'refused');
            throw new Error(`team tool guard: "${name}" reached the dispatch door twice under one call id against two different ToolDefinitions; the call is refused [refused at the dispatch door, the stage nearest the Body]`);
        }
        const handoff = armWrapperSignal(exec, record);
        if (!handoff.ok) {
            // No wrapper, no guarantee: the after-door window would be wide open, so
            // the call is refused instead of running through it.
            observe({ event: 'dispatcher-signal-wrapper-unavailable', callId, tool: name, detail: handoff.detail });
            dispatcher.endCallById(callId, 'refused');
            throw new Error(`team tool guard: "${name}" cannot be made cancellable on this execution (${handoff.detail}); without a cancellable signal a Definition that moves after this door could not be refused before its Body, and this lane does not run calls it cannot stop [refused at the dispatch door, the stage nearest the Body]`);
        }
        try {
            const settled = await next();
            // U6 PR2 (kernel-enforcing delta at this door — see the `kernelGuard`
            // input): for a KERNEL-OWNED name, re-resolve the live definition
            // after the settle. If the Body moved away from the identity this
            // door pinned OR from the identity the center table binds, the
            // result is not table-backed and a SUCCESS-shaped settle is
            // converted into a fail-closed refusal (sup-a §1.2 post-check, §5
            // cond 8/10). Error- and cancelled-shaped settles keep their native
            // shape — they are refusals already, never successes wearing a moved
            // Body; an unchanged Body keeps the native success shape untouched.
            // The settled edge's alarm + armed-once withdrawal law stays as the
            // settled edge's law for EVERY other name (no dual identity: the
            // Guard's live-vs-feed comparison remains the one identity law —
            // this door only consumes the table's answer and vetoes).
            if (input.kernelGuard?.owns(name) === true) {
                const settledIsError = settled?.isError === true;
                const settledIsCancelled = settled?.cancelled === true;
                if (!settledIsError && !settledIsCancelled) {
                    const now = readDefinition(name);
                    const tableIdentity = input.kernelGuard.identityFor(name);
                    const drifted = !now.ok
                        || now.fingerprint !== pinned.fingerprint
                        || (tableIdentity !== null && tableIdentity !== now.fingerprint);
                    if (drifted) {
                        observe({
                            event: 'kernel-post-success-drift-veto',
                            callId,
                            tool: name,
                            pinned: pinned.fingerprint,
                            current: now.ok ? now.fingerprint : now.detail,
                            table: tableIdentity ?? 'unbound',
                            note: 'the kernel-owned definition moved while this call executed; its successful result is vetoed fail-closed (U6 PR2) — the table no longer backs the Body that answered',
                        });
                        throw new Error(`team tool guard: "${name}" is kernel-owned and its definition moved while the call ran (pinned ${pinned.fingerprint}, resolving ${now.ok ? now.fingerprint : `unreadable (${now.detail})`}${tableIdentity === null ? '' : `, table ${tableIdentity}`}); the result is refused fail-closed — an unverified Body's success is never delivered [refused at the dispatch gate, after execution]`);
                    }
                }
            }
            return settled;
        }
        finally {
            handoff.restore();
        }
    }), 'without it a call racing the teardown, or one whose Definition moved after the Guard stage, could reach a Body');
    if (!armedExecute.ok)
        return armedExecute;
    // 5/5 — the Guard itself (already armed above; counted as a seam only now, so
    // that publishing waits until the whole set is provably in place).
    dispatcher.armSeam('tools.guard');
    // `tools/change` — LOAD-BEARING since B3, and STILL not a permission.
    //
    // PR1 armed this channel for diagnostics and could afford to lose it, because
    // nothing it reported was a safety mechanism. That changed with the B3 ruling:
    // cancelling an un-executed call whose Definition moved is now done by the
    // notification itself, because the notification is the only public thing that
    // arrives inside the last gap. So a channel that cannot be subscribed is no
    // longer a smaller diagnostic surface — it is a lane whose central promise is
    // unbacked, and the assembly says so and refuses (the same rule PR1 Gate F3
    // set for the five seams: a Guard missing one door is an open world that says
    // "closed").
    //
    // What the event itself says is nothing: `tools/change` carries no arguments
    // and is deliberately NOT scope-filtered (`index.ts:203-206`). Every reaction
    // below therefore does its own (scope, name) filtering by RE-READING the
    // public seam, which is also what keeps one plugin's refresh from cancelling
    // another plugin's in-flight calls.
    try {
        extraDisposers.push(onEvent('tools/change', () => {
            changeChannel = 'proven';
            const result = revalidate();
            if (result.denied.length > 0) {
                observe({ event: 'tools-change-unbound-names', denied: result.denied, note: 'these names are refused at dispatch by the Guard' });
            }
            if ((result.drifted?.length ?? 0) > 0) {
                observe({ event: 'tools-change-definition-drift', drifted: result.drifted, note: 'their Bindings were revised down; only an explicit re-bind restores them' });
            }
            const cancelled = pendingCalls.onRegistryChange((record) => {
                const now = readDefinition(record.name);
                return now.ok ? { ok: true, identity: now.fingerprint } : { ok: false, identity: now.detail };
            });
            if (cancelled.length > 0) {
                observe({
                    event: 'dispatcher-change-abort-issued',
                    calls: cancelled.map((row) => ({ callId: row.callId, tool: row.name, pinned: row.pinnedIdentity, current: row.currentIdentity })),
                    note: 'the validated Definition moved while these calls were between the dispatch door and the registry\'s own resolution, so their signals were raised; the registry refuses them before it resolves a Body, and the settled edge reports each one\'s actual outcome',
                });
            }
        }));
    }
    catch (error) {
        return assemblyFailed('IO_POLICY_UNSUPPORTED', `cannot subscribe to the public notification "tools/change": ${String(error?.message ?? error)} — since the B3 ruling the cancellation of an un-executed call is driven by that notification, so without it this lane cannot promise that a Definition which moves after its dispatch door will be refused before its Body; the assembly is declared unsupported rather than delivered with that hole closed over`);
    }
    const bindAll = (names, origin) => {
        // The pb §6 feed is gated on PLACEMENT: an entry only ever counts for a
        // name this assembly declared it placed. A feed entry for any other name
        // would credit a Body the assembly never registered — that is the
        // discovery-style self-pin (R5), and it is a refusal, never a binding.
        const placedNames = new Set(input.assemblyOwnedNames ?? []);
        for (const name of names) {
            // A real Binding pins the real Body. `origin:name` would be a
            // name-shaped guess, and a guess cannot be re-verified at dispatch, so
            // the assembly reads the definition seam here and refuses to bind
            // anything it cannot pin (PR1 Gate R2).
            const probe = readDefinition(name);
            if (!probe.ok) {
                observe({ event: 'bind-refused-unreadable-definition', tool: name, origin, detail: probe.detail });
                return fail('TOOL_BINDING_UNVERIFIED', `cannot bind "${name}" as ${origin}: its current definition is unreadable at the public seam (${probe.detail}), and a Binding that cannot be re-verified is not a verification`);
            }
            // THE pb §6 BINDING FEED (provider side): when the assembly supplies a
            // placement record for this name, the pin is the PROVIDER'S recorded
            // identity, and the live scoped read only proves CONTINUITY with it.
            // No feed entry = the pre-feed path, byte-for-byte (this seam only
            // tightens). A feed never produces an allow anywhere the per-call
            // Guard is not already the law: the Binding it yields is re-checked
            // against the same scoped read on every call.
            const feed = origin === 'team-own' && input.bindingFeed !== undefined ? input.bindingFeed(name) : undefined;
            if (feed !== undefined) {
                if (typeof input.realmId !== 'string' || input.realmId.length === 0 || feed.realmId !== input.realmId) {
                    observe({
                        event: 'bind-refused-feed-realm-mismatch',
                        tool: name,
                        origin,
                        entryRealm: feed.realmId,
                        assemblyRealm: input.realmId ?? null,
                        note: 'a placement identity is evidence only inside the realm that made it; a feed entry from another realm is a cross-realm same-name attempt and is refused, never compared',
                    });
                    return fail('TOOL_BINDING_UNVERIFIED', `cannot bind "${name}" from the binding feed: the entry names realm "${feed.realmId}" but this assembly places in realm "${String(input.realmId ?? '(unset)')}" — a same name in another realm is a different world (design §2.1: Realm 不可混淆), and its identity never verifies here`);
                }
                if (!placedNames.has(name)) {
                    observe({
                        event: 'bind-refused-feed-unplaced-name',
                        tool: name,
                        origin,
                        note: 'the feed carried an identity for a name this assembly never placed (not in assemblyOwnedNames): crediting a Body nobody placed is the R5 self-pin shape, refused',
                    });
                    return fail('TOOL_BINDING_UNVERIFIED', `cannot bind "${name}" from the binding feed: the feed carries an identity for a name this assembly never placed (placement attribution is the only feed authority; a discovery-style comparison-side pin verifies the shadowing Body and is the R5-falsified shape)`);
                }
                if (feed.definitionIdentity !== probe.fingerprint) {
                    observe({
                        event: 'bind-refused-feed-placement-drift',
                        tool: name,
                        origin,
                        placed: feed.definitionIdentity,
                        current: probe.fingerprint,
                        note: 'the name no longer resolves to the Definition the provider placed; pinning the current Body would verify whatever moved in afterwards, so the bind is refused and the assembly stands or falls on it',
                    });
                    return fail('TOOL_BINDING_UNVERIFIED', `cannot bind "${name}" from the binding feed: the provider placed ${feed.definitionIdentity} but the public seam now resolves ${probe.fingerprint} — the Body moved between placement and bind; refusing rather than verifying a shadow this assembly never placed`);
                }
                observe({
                    event: 'binding-feed-verified',
                    tool: name,
                    origin,
                    realm: feed.realmId,
                    identity: feed.definitionIdentity,
                    note: 'the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against',
                });
            }
            // An explicit re-bind by the trusted assembly is the ONLY documented way
            // back from a withdrawal (definition drift, an unreadable definition, or a
            // call-edge move), and PR1's own rule is that a change is an IMMUTABLE
            // HIGHER revision under the same Binding identity. So the revision comes
            // from what is in force, never from a constant: a second bind of the same
            // name is revision 2, and a name that was never bound is revision 1.
            const inForce = dispatcher.surface.entryOf(name);
            const binding = {
                bindingId: `${origin}:${input.agentScopeKey}:${name}`,
                agentScopeKey: input.agentScopeKey,
                toolName: name,
                definitionIdentity: probe.fingerprint,
                providerId: origin === 'team-mcp' ? 'mcp' : 'dsh-agent-team',
                implementationOrigin: 'team-trusted-extension',
                executionBoundary: 'trusted-host',
                assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
                policyGeneration: dispatcher.policyGeneration(),
                authorityGeneration: dispatcher.authorityGeneration(),
                revision: (inForce?.revision ?? 0) + 1,
                status: 'ACTIVE',
            };
            const outcome = dispatcher.bind({ name, origin, binding, verified: true });
            if (!outcome.ok)
                return outcome;
        }
        return { ok: true, value: undefined };
    };
    // Whether this Agent's mask + Guard have already been taken down. The
    // teardown is idempotent on the STATE (it may be called again after a
    // refusal) but the resource release happens exactly once.
    let tornDown = false;
    const handle = {
        dispatcher,
        publish: () => {
            // Step 4/5: the surface must be readable and fully governed at the
            // moment of publishing; anything unbound after this point is a runtime
            // denial, not a publish-time exception.
            const surface = readSurface(input.agentCtx, input.runtimeAgent);
            if (!surface.ok) {
                dispatcher.failAssembly(surface.error.message);
                return surface;
            }
            // The publish-surface observation is a LIST OF NAMES, and a name on a
            // surface proves only visibility. Pin each one through the public
            // definition seam, then let the surface decide: only a name on the
            // assembly's explicit trusted native list, pinnable right now, AND
            // resolved to the SAME definition by the trusted global view, is inherited
            // as a verified native. Every other observed name is bound UNVERIFIED
            // (governed, loud, refused at dispatch). Registering an undeclared own
            // tool before publish therefore produces a refusal after publish, not a
            // `native:` Binding it earned by showing up — and so does registering a
            // SAME-NAME shadow of a native one (residual R-a).
            const identities = {};
            const trusted = {};
            for (const name of surface.value) {
                const probe = readDefinition(name);
                if (probe.ok)
                    identities[name] = probe.fingerprint;
                const trustedProbe = readTrustedDefinition(name);
                if (trustedProbe.ok)
                    trusted[name] = trustedProbe.fingerprint;
            }
            const owned = new Set(input.assemblyOwnedNames ?? []);
            const nativeNames = (input.nativeNames ?? []).filter((n) => surface.value.includes(n) && !owned.has(n));
            const inherited = dispatcher.bindInheritedSurface(surface.value, identities, trusted);
            if (inherited.shadowed.length > 0) {
                observe({
                    event: 'published-surface-shadowed',
                    names: inherited.shadowed.map((row) => row.name),
                    detail: inherited.shadowed
                        .map((row) => `${row.name}: the trusted global definition is ${row.trusted} but this Agent resolves ${row.resolved}`)
                        .join('; '),
                    note: 'on the trusted native list, but a same-name contribution shadows it for this Agent: bound UNVERIFIED and refused at dispatch, never credited with the native verification it does not carry',
                });
            }
            if (inherited.nativeUnreadable.length > 0) {
                observe({
                    event: 'published-surface-native-unreadable',
                    names: inherited.nativeUnreadable,
                    note: 'the trusted (global) side of the definition read was unavailable, so the name-vs-definition comparison could not be made: bound UNVERIFIED rather than credited',
                });
            }
            if (inherited.unverified.length > 0) {
                observe({
                    event: 'published-surface-unverified',
                    names: inherited.unverified,
                    note: 'observed on the publish surface, not attributable to a trusted native source and not bound by this assembly: governed and refused at dispatch',
                });
            }
            observe({
                event: 'surface-inherited',
                nativeTrusted: nativeNames.length,
                verified: inherited.verifiedBound,
                unverified: inherited.unverifiedBound,
            });
            const outcome = dispatcher.publish();
            if (outcome.ok) {
                observe({ event: 'agent-published', scope: input.agentScopeKey, surface: surface.value.length, masked: input.maskedNames?.length ?? 0, seams: dispatcher.seamsArmed() });
            }
            else {
                // The Guard is not published, so it must not remain on the ctx either:
                // an unarmed-but-armed Guard would refuse calls nobody can explain.
                unarmAll();
                dispatcher.failAssembly(outcome.error.message);
            }
            return outcome;
        },
        bindOwnTools: (names) => bindAll(names, 'team-own'),
        bindMcpTools: (names) => bindAll(names, 'team-mcp'),
        revalidate,
        disposeOrdered: () => {
            // NEG-1: refuse first, drain with the mask KEPT, tombstone, and only
            // release on the Dispatcher's OWN zero count.
            const drain = dispatcher.beginDrain();
            if (!drain.ok && dispatcher.state() !== 'DRAINING' && dispatcher.state() !== 'TOMBSTONED' && dispatcher.state() !== 'RELEASED') {
                observe({ event: 'dispose-drain-refused', detail: drain.error.message, state: dispatcher.state() });
            }
            if (dispatcher.state() === 'DRAINING') {
                const tomb = dispatcher.tombstone();
                if (!tomb.ok)
                    return tomb;
            }
            if (dispatcher.state() === 'TOMBSTONED') {
                const release = dispatcher.release();
                if (!release.ok)
                    return release;
            }
            if (dispatcher.state() === 'RELEASED' || dispatcher.state() === 'UNBOUND') {
                if (tornDown) {
                    // A second close is a no-op. Re-running it would lift a mask that is
                    // already gone and report a lift that never happened, and a false
                    // "lifted again" is exactly the kind of evidence this lane refuses
                    // to hand out.
                    observe({ event: 'dispose-noop', scope: input.agentScopeKey, state: dispatcher.state() });
                    return { ok: true, value: undefined };
                }
                tornDown = true;
                // RELEASED (or never ACTIVE at all): now, and only now, the mask and
                // the Guard go — mask FIRST, Guard LAST (the reverse of install). The
                // lift happens AT MOST ONCE per Agent.
                if (input.maskPort !== undefined) {
                    try {
                        input.maskPort.lift();
                        observe({ event: 'mask-lifted', scope: input.agentScopeKey, at: dispatcher.state() });
                    }
                    catch (error) {
                        observe({ event: 'mask-lift-failed', detail: String(error?.message ?? error) });
                    }
                }
                if (typeof guardDispose === 'function') {
                    try {
                        guardDispose();
                    }
                    catch {
                        /* an already-disposed scope is not a safety change */
                    }
                }
                for (const off of extraDisposers.splice(0)) {
                    try {
                        off();
                    }
                    catch {
                        /* already-off listeners are not a safety change */
                    }
                }
                observe({ event: 'guard-released', scope: input.agentScopeKey, state: dispatcher.state() });
                return { ok: true, value: undefined };
            }
            return {
                ok: false,
                error: {
                    code: 'EXECUTION_TERMINATION_UNCONFIRMED',
                    message: `dispose stopped at ${dispatcher.state()}: the mask and the Guard stay armed`,
                    sideEffectUnknown: true,
                },
            };
        },
        surfaceNames: () => readSurface(input.agentCtx, input.runtimeAgent),
        observations: () => [...observations],
        pendingCalls: () => pendingCalls.outstanding(),
        changeChannelStatus: () => changeChannel,
    };
    return { ok: true, value: handle };
}
//# sourceMappingURL=install.js.map