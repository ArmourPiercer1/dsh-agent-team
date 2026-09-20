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
import type { TeamArtifactAuthority } from './authority.js';
/**
 * The structured stream of the foreground shell canonical value (the
 * `stdout` / `stderr` object). Mirrored from the pinned upstream
 * `canonicalBashResult` shape (`text` + `truncated` + optional
 * `spillPath`).
 */
export interface ForegroundStreamMirror {
    /** The (possibly truncated) inline text. NEVER read by this module. */
    readonly text: string;
    /** Whether the stream was truncated into a spill file. */
    readonly truncated: boolean;
    /** The model-visible spill path (the ONLY locator authority). */
    readonly spillPath?: string;
}
/**
 * The structured canonical value of a foreground shell execution
 * (`result.value`). Only the fields the observer reads are declared:
 * the discriminant + the two streams. `exitCode` / `signal` / `timedOut`
 * / `aborted` are deliberately NOT declared — they are NOT decision
 * inputs (R1: the `isError` discriminant of the RESULT, not the command
 * outcome, bounds the observation).
 */
export interface ForegroundShellValueMirror {
    readonly kind: 'foreground';
    readonly stdout?: ForegroundStreamMirror;
    readonly stderr?: ForegroundStreamMirror;
}
/**
 * The minimal structural view of the `ToolExecution` payload: the tool
 * name (the shell-class filter) and the call id (the shell-foreground
 * source's audit provenance).
 */
export interface ShellExecMirror {
    readonly name: string;
    readonly callId: string;
}
/**
 * The minimal structural view of the `ToolExecutionResult` payload.
 * `content` is deliberately ABSENT (R2 — rendered text never mints
 * authority; a mirror without the field cannot read it). `value` is
 * declared `unknown` and narrowed by {@link isForegroundShellValue}
 * (the canonical-value check is the only narrowing — no other shape is
 * consulted).
 */
export interface ShellResultMirror {
    readonly isError: boolean;
    readonly value?: unknown;
}
/**
 * The minimal structural mirror of the agent-scoped registration
 * surface (the upstream cordis `Context.on` for the agent-scoped
 * `tools/result` observation event): registering a listener is an
 * effect — `on` returns the disposer that removes it (the glue stores
 * it in the agent lifecycle's `toolDisposers`, the same drain the
 * permission listener rides).
 */
export interface AgentShellResultCtx {
    /**
     * Register one observation listener on the named agent-scoped event.
     * @param event - the event name (`'tools/result'`).
     * @param listener - the observation listener (receives the exec
     *   payload and the result; the upstream emitter invokes it without
     *   awaiting the returned promise — R5).
     * @returns the disposer removing the listener.
     */
    on(event: string, listener: (exec: ShellExecMirror, result: ShellResultMirror) => void | Promise<void>): () => void;
}
/** The fault context of one contained observer fault (diagnostics only). */
export interface ShellObserverFaultContext {
    /** The observed tool name (present whenever the tool-name filter passed). */
    readonly toolName: string | undefined;
    /** The observed call id (present whenever the call-id filter passed). */
    readonly callId: string | undefined;
    /** The stream whose record failed (absent for pre-record faults). */
    readonly stream?: 'stdout' | 'stderr';
}
/** The input of {@link installShellResultObserver}. */
export interface InstallShellResultObserverParams {
    /**
     * The Team artifact-read authority of the production root (the glue
     * reads it from the host-filled reference — absent (factory world /
     * not wired) the glue installs NO observer: alpha.1 behavior, the
     * shell spill stays upstream-equivalent).
     */
    readonly authority: TeamArtifactAuthority;
    /** The TeamSession of this agent (the durable setup context). */
    readonly rootSessionId: string;
    /** This agent's instance id (the durable setup context). */
    readonly instanceId: string;
    /**
     * The shell tool names to observe (frozen default `bash` + `pwsh` —
     * the foreground shell class of the pinned upstream). Optional for
     * test seams; a name never matches a decision lane (R1).
     */
    readonly toolNames?: readonly string[];
    /**
     * The optional fault hook (the glue wires it to its observation
     * surface). Diagnostics only: the hook's own faults are contained
     * (R4) — a throwing hook never affects the observation.
     */
    readonly onFault?: (fault: unknown, context: ShellObserverFaultContext) => void;
}
/** The frozen default shell class (R1). */
export declare const SHELL_OBSERVER_DEFAULT_TOOLS: readonly string[];
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
export declare function installShellResultObserver(ctx: AgentShellResultCtx, params: InstallShellResultObserverParams): () => void;
//# sourceMappingURL=shell-result-observer.d.ts.map