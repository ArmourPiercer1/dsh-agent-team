/**
 * Team model overlay — the P5-T3 implementation of the binder's `model`
 * overlay slot (TaskDoc §11.5 P5-T3; DevPlan §18.4; ruling R30).
 *
 * The model overlay resolves the Team model's EFFECTIVE selection at
 * REQUEST time, per session:
 *
 * - {@link TeamModelSelectionAdapter} — the session-scoped resolution
 *   core. `beginRequest` captures the source's current selection at the
 *   capture moment (future-boundary mutation: an in-flight request keeps
 *   its capture; the next request resolves the source afresh). `install`
 *   is the fresh-time (re-)establishment effect (idempotent; a
 *   re-installation clears dead in-flight captures — a re-installation
 *   only ever happens onto a (re)created residency, so any surviving
 *   capture belongs to a dead residency, DevPlan §18.5). `drop` is the
 *   explicit restart boundary (the residency was dropped, e.g. SETTLED
 *   with the Agent handle absent): the session's in-flight captures are
 *   discarded so they cannot leak into the next request (ruling R30:
 *   "在飞状态不跨重启泄漏"), while the installed marker persists — the
 *   overlay is scoped to the SESSION, not to the ephemeral residency;
 * - {@link TeamModelOverlaySlot} — the T1 {@link OverlaySlot} contract
 *   implementation: `name: 'model'`, `apply` performs exactly one public
 *   Agent setup effect (the adapter's `install`) and nothing else.
 *
 * The frozen DevPlan §18.4 semantics are honored verbatim:
 *
 * ```text
 * request N = model A
 * concurrent override -> B
 * request N remains A
 * request N+1 uses B
 * ```
 *
 * and the frozen restart semantics (ruling R30; DevPlan §18.5): in-flight
 * state never leaks across a restart, and the first request after a
 * restart resolves the source's CURRENT value — no stale capture survives
 * (resolution happens at request time, never at install time, so nothing
 * pre-resolved can go stale).
 *
 * What this module does NOT do (global forbidden block):
 *
 * - no upstream source modification and no upstream-private API import
 *   (CORE PATCH BUDGET = 0); the public ModelSelection is used through the
 *   mock-first seam of ./types.js (the real public seam binding lands in
 *   T5/T6);
 * - no Team SessionEvent vocabulary (the binder is the single event
 *   emitter, P5-T1 contract);
 * - no TeamDomain access (the overlay never reads or writes durable
 *   records);
 * - no legacy `packages/team` vocabulary.
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no timers, no
 * runtime environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/model/overlay
 */
/** One in-flight request capture (adapter-owned; the public handle). */
class InFlightModelRequest {
    selection;
    completed = false;
    release;
    constructor(selection, release) {
        this.selection = selection;
        this.release = release;
    }
    complete() {
        if (this.completed)
            return;
        this.completed = true;
        this.release();
    }
}
/**
 * The session-scoped Team model selection core (DevPlan §18.4).
 *
 * The adapter RESOLVES the injected public ModelSelection seam; it never
 * writes it. Its per-session state is deliberately minimal and
 * EPHEMERAL-safe: an `installed` marker (a ratchet) plus the active
 * in-flight captures. It holds no pre-resolved selection — the effective
 * selection always exists only as (a) the source's current value and (b)
 * the captures of in-flight requests — which is what makes the restart
 * semantics hold: after a restart, the next request resolves the source's
 * current value, never a stale capture (ruling R30).
 */
export class TeamModelSelectionAdapter {
    source;
    /** Sessions whose model overlay is installed (ratchet — see `install`). */
    installedSessions = new Set();
    /** Active (in-flight) request captures per session. */
    inFlightBySession = new Map();
    /**
     * @param source - the injected public ModelSelection seam (mock-first).
     */
    constructor(source) {
        this.source = source;
    }
    /**
     * (Re-)establish the model overlay for one bound session (the FRESH-time
     * public Agent setup effect, invoked by the slot's `apply`).
     *
     * Idempotent, and a (re-)establishment CONVERGENCE: a re-installation
     * only ever happens onto a (re)created residency (the binder re-drives
     * `apply` after a partial bind, or on a re-bind after the residency was
     * dropped), so any captures still registered belong to a DEAD residency
     * and are cleared — no stale capture can outlive the re-installation
     * (DevPlan §18.5: Agent residency is ephemeral).
     *
     * The installed marker is a RATCHET: once installed it persists across a
     * residency drop (`drop`) — the overlay is scoped to the SESSION (the
     * restored scope always carries the full slot set), not to the ephemeral
     * residency.
     *
     * The call performs no resolution (it never reads the source) and no
     * effect on the source.
     *
     * @param sessionId - the bound session id.
     */
    install(sessionId) {
        const id = String(sessionId);
        this.inFlightBySession.delete(id);
        this.installedSessions.add(id);
    }
    /**
     * Begin one request for the session: resolve and CAPTURE the effective
     * selection at request time (the DevPlan §18.4 "request N = model A"
     * moment).
     *
     * The capture is a COPY of the source's current value taken at this
     * moment; it is immutable for the request's lifetime. A concurrent
     * source mutation (a future-boundary mutation) takes effect from the
     * NEXT `beginRequest` only — "request N remains A; request N+1 uses B".
     * Resolution happens here, never at install time: a pre-resolved or
     * cached selection would go stale across a restart (ruling R30: the
     * first request after a restart uses the source's current value).
     *
     * An `undefined` current value is losslessly carried as an `undefined`
     * capture (the request proceeds with provider/default behavior).
     *
     * @param sessionId - the bound session id.
     * @returns the in-flight request handle (its `selection` is the capture).
     * @throws when the injected source's `current` faults (a source fault
     *   propagates fail-closed; no capture is registered).
     */
    beginRequest(sessionId) {
        const id = String(sessionId);
        const current = this.source.current();
        const selection = current === undefined ? undefined : { ...current };
        const captures = this.inFlightBySession.get(id) ?? new Set();
        this.inFlightBySession.set(id, captures);
        const release = () => {
            captures.delete(request);
        };
        const request = new InFlightModelRequest(selection, release);
        captures.add(request);
        return request;
    }
    /**
     * The RESTART boundary: the session's Agent residency was dropped
     * (DevPlan §18.5 — at SETTLED the Agent handle may be absent; the
     * durable TeamDomain and the selection source survive). The session's
     * in-flight captures are DISCARDED: they belong to the dead residency
     * and must not leak into the next request (ruling R30: "在飞状态不跨
     * 重启泄漏"). The installed marker persists (see `install`).
     *
     * A no-op for a session without registered captures.
     *
     * @param sessionId - the session whose residency was dropped.
     */
    drop(sessionId) {
        this.inFlightBySession.delete(String(sessionId));
    }
    /**
     * Whether the model overlay is installed for the session (ratchet — see
     * `install`; persists across a residency drop).
     * @param sessionId - the session id.
     */
    installed(sessionId) {
        return this.installedSessions.has(String(sessionId));
    }
    /**
     * The number of this session's requests currently in flight (active
     * captures).
     * @param sessionId - the session id.
     */
    inFlight(sessionId) {
        const captures = this.inFlightBySession.get(String(sessionId));
        return captures === undefined ? 0 : captures.size;
    }
}
/**
 * The P5-T3 implementation of the binder's `model` OVERLAY SLOT (the T1
 * {@link OverlaySlot} contract: `name` + `apply`).
 *
 * `apply` performs exactly one public Agent setup effect — the adapter's
 * `install` on the bound session — and nothing else (the slot contract:
 * PUBLIC Agent setup effects only; no TeamDomain write, no session event —
 * the binder records `agent-setup/overlay-installed`). Idempotent per the
 * slot contract: a re-drive after a partial bind (or a re-bind after the
 * residency was dropped) converges to the same installed state (see
 * {@link TeamModelSelectionAdapter.install}).
 *
 * The real DSH public model-selection binding (T5/T6) replaces the
 * mock-first source at the adapter's construction; the slot itself is
 * seam-agnostic.
 */
export class TeamModelOverlaySlot {
    name = 'model';
    adapter;
    /**
     * @param adapter - the session-scoped model selection core this slot
     *   installs (constructed over the injected public ModelSelection seam).
     */
    constructor(adapter) {
        this.adapter = adapter;
    }
    /**
     * Install the model overlay on the target's agent residency.
     * @param context - the step context (identity + durable record + path).
     * @throws when the adapter's `install` faults (the binder wraps it as
     *   the closed `BINDER_OVERLAY_FAILED`; fail-closed before work — no
     *   later slot runs, no admission decision runs, the target is not
     *   registered as bound).
     */
    apply(context) {
        this.adapter.install(context.target.sessionId);
    }
}
//# sourceMappingURL=overlay.js.map