/**
 * Strict-read + Core-spill — the `tools/result` adapter (Phase D,
 * architecture §14 / implementation guide §13).
 *
 * One observer per Team agent (installed on the AGENT-SCOPED ctx — the
 * same scope the parameter-permission lane listens on). It watches the
 * foreground shell results of ITS OWN agent and, for every spilled
 * stream, records the durable shell-foreground artifact grant through
 * the shared {@link TeamArtifactAuthority}:
 *
 *   foreground bash/pwsh success → structured `value` carries
 *   `stdout.spillPath` / `stderr.spillPath` → one
 *   `recordShellArtifact` per non-empty path (the authority does the
 *   fresh resolve + stat + digests + durable fact put + runtime install).
 *
 * Pure module: it consumes a STRUCTURAL mirror of the DSH
 * `tools/result` event surface — no DSH import (the same seam-free
 * convention as {@link SpillStoreSource}; the live glue is plain `.mjs`
 * and passes the real cordis agent ctx, whose `ctx.on` registration is
 * an effect returning the disposer the glue stores in the agent
 * lifecycle's `toolDisposers` — the same drain the permission listener
 * rides, so a cold-resume re-setup reinstalls BOTH as a unit).
 *
 * Design rulings (frozen semantics, architecture §14 + §17):
 *
 * R1 — SUCCESS-ONLY, CANONICAL-VALUE-ONLY: the observer records for a
 *   tool call only when `result.isError === false` AND the structured
 *   `result.value` is a foreground shell result (`kind: 'foreground'`)
 *   AND the tool is a foreground shell (`bash` / `pwsh` by default)
 *   with a non-empty call id. The abort paths of the pinned upstream
 *   shell tools THROW (they never produce a success value), so the
 *   `isError` filter covers aborts. A NON-ZERO exit or a timeout still
 *   yields a canonical success value (the tool executed; the exit code
 *   rides `value.exitCode` / `value.timedOut`) — its spilled output is
 *   recorded too: reading back failed or partial output is a first-class
 *   agent need, and the authority's fresh identity check (not the exit
 *   code) is what bounds the grant.
 *
 * R2 — NEVER READ RENDERED TEXT (invariant 2): the observer reads ONLY
 *   the structured canonical value. `result.content` is deliberately NOT
 *   declared on the structural result mirror — a module that does not
 *   declare it cannot read it (the type-level expression of "rendered
 *   text never mints authority"). A locator string appearing in the
 *   rendered text mints nothing: the only locators recorded are the
 *   `spillPath` fields of the structured value.
 *
 * R3 — LOCATORS ARE TRANSPORT ONLY (invariant 1): the recorded
 *   `spillPath` strings are re-verified fresh behind
 *   `recordShellArtifact` (resolve + stat + digests over the DSH fs
 *   seam). This module never parses, resolves, or stats a path itself.
 *
 * R4 — FULL FAULT CONTAINMENT: the observer NEVER throws into the
 *   pipeline. Every `recordShellArtifact` rejection is caught per stream
 *   (a failed record = no grant — the strict-read read stays denied as
 *   before; fail-closed by construction, and the already-committed tool
 *   result is untouched — an observer cannot undo it). The optional
 *   `onFault` hook is itself guarded (a throwing hook never affects the
 *   observation). The upstream emitter's own observer-fault containment
 *   (the `tools/result observer failed` warn at the emit site) is a
 *   second, upstream-owned layer this module deliberately does not rely
 *   on: its containment is the pipeline's, not the grant vertical's.
 *
 * R5 — ASYNC, OFF THE CRITICAL PATH: the listener is `async` and the
 *   emitter does not await observation listeners (the pinned
 *   `notifyResult` does `void Promise.resolve(returned).catch(…)`), so
 *   the durable record (a couple of fs identity reads + one ledger
 *   append) never delays the tool result commit. Ordering inside one
 *   execution (stdout before stderr) is preserved by the sequential
 *   await within the listener; a read of the artifact that arrives
 *   before the record settles simply finds no grant yet and proceeds
 *   through the unchanged pipeline (the model's next tool call is a
 *   round trip later — the record settles in the meantime).
 *
 * @module @dsh-agent-team/runtime/artifact-read/shell-result-observer
 */
/** The frozen default shell class (R1). */
export const SHELL_OBSERVER_DEFAULT_TOOLS = ['bash', 'pwsh'];
/** The two observable streams, in the record order. */
const OBSERVED_STREAMS = ['stdout', 'stderr'];
// --- internals -------------------------------------------------------------------
/** The structured canonical-value discriminant check (R1/R2). */
function isForegroundShellValue(value) {
    if (typeof value !== 'object' || value === undefined || value === null)
        return false;
    return value.kind === 'foreground';
}
/**
 * The stream's non-empty `spillPath`, or `undefined` (a missing stream
 * object, a missing field, or an empty string are all "no spill" — the
 * locator must be a non-empty string or it is not recorded).
 */
function spillPathOf(value, stream) {
    const s = value[stream];
    if (typeof s !== 'object' || s === undefined || s === null)
        return undefined;
    const p = s.spillPath;
    return typeof p === 'string' && p.length > 0 ? p : undefined;
}
// --- the install -----------------------------------------------------------------
/**
 * Install the agent-scoped `tools/result` observer of one Team agent
 * (the Phase D vertical).
 *
 * The returned value is the `ctx.on` disposer (the glue pushes it onto
 * the agent lifecycle's `toolDisposers` — the same drain the permission
 * listener rides, so install/dispose stay paired across cold resumption).
 *
 * @param ctx - the agent-scoped registration surface (the real cordis
 *   agent ctx from the glue).
 * @param params - the authority + the agent's durable composite
 *   identity + the optional seams (see {@link InstallShellResultObserverParams}).
 * @returns the disposer removing the listener.
 */
export function installShellResultObserver(ctx, params) {
    const toolNames = params.toolNames ?? SHELL_OBSERVER_DEFAULT_TOOLS;
    const reportFault = (fault, context) => {
        if (params.onFault === undefined)
            return;
        try {
            params.onFault(fault, context);
        }
        catch {
            // R4: a throwing fault hook is contained — the observation
            // proceeds (and the upstream emitter's own containment remains
            // available as the second layer for anything that escapes).
        }
    };
    const listener = async (exec, result) => {
        // Shape guards (malformed payloads are inert, never faults): the
        // pinned upstream invariants make exec/result plain frozen objects,
        // but the observer never assumes — a non-object is simply not
        // observed.
        if (typeof exec !== 'object' || exec === undefined || exec === null)
            return;
        if (typeof result !== 'object' || result === undefined || result === null)
            return;
        // R1 — successful tool executions only (a failure carries no
        // canonical value; the abort paths of the shell tools throw, so
        // they land here as failures).
        if (result.isError)
            return;
        const toolName = typeof exec.name === 'string' && exec.name.length > 0 ? exec.name : undefined;
        if (toolName === undefined || !toolNames.includes(toolName))
            return;
        const callId = typeof exec.callId === 'string' && exec.callId.length > 0 ? exec.callId : undefined;
        if (callId === undefined)
            return;
        // R1/R2 — the structured canonical value is the only authority
        // source (rendered text is never read — the mirror does not even
        // declare it).
        if (!isForegroundShellValue(result.value))
            return;
        const value = result.value;
        for (const stream of OBSERVED_STREAMS) {
            const locator = spillPathOf(value, stream);
            if (locator === undefined)
                continue;
            const args = {
                rootSessionId: params.rootSessionId,
                instanceId: params.instanceId,
                source: { kind: 'shell-foreground', toolName, callId, stream },
                locator,
            };
            try {
                await params.authority.recordShellArtifact(args);
            }
            catch (fault) {
                // R4 — a failed record = no grant (fail-closed: the strict-read
                // read stays denied as before; the committed tool result is
                // untouched). Diagnostics through the guarded hook only.
                reportFault(fault, { toolName, callId, stream });
            }
        }
    };
    return ctx.on('tools/result', listener);
}
//# sourceMappingURL=shell-result-observer.js.map