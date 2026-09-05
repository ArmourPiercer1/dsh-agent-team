/**
 * FakeAgentFactoryAdapter — the deterministic in-memory implementation of
 * {@link AgentFactoryAdapter} (TaskDoc §11.5 P4-T4 "先使用 fake external
 * effect；不要在此 task 实现真正 Agent runtime").
 *
 * This is the ONLY adapter implementation shipped in this task. It models
 * the external child-session effect with NO live Agent, NO DSH runtime
 * call, NO process spawn, NO real filesystem, and NO `node:` builtin — just
 * an in-memory map — so the durable state machine and its crash/recovery
 * semantics can be exercised (and asserted) hermetically.
 *
 * Behaviors the tests rely on:
 *
 * - **Idempotent on the member identity** `(rootSessionId, instanceId)`:
 *   the first call mints a deterministic child session id and records it;
 *   every later call for the same member returns the SAME id (the factory
 *   never mints a second child for one member). This is the adapter contract
 *   that makes "effect success but lost durable record" converge to ONE
 *   child (see `adapter.ts` module docs).
 * - **Deterministic child ids**: `session-child-<token>` where the token is
 *   a deterministic function of `(rootSessionId, instanceId)` — so the id
 *   is stable across calls and stable across fresh fakes (a re-created fake
 *   in a "process restart" re-derives the same child id for the same
 *   member, which is what a real idempotent factory would do).
 * - **Scriptable failure injection** for the negative / crash tests:
 *   `failNext(n)` makes the next `n` calls reject (with a typed
 *   `FakeAdapterError`), modelling the external effect failing (e.g. the
 *   DSH session store rejecting creation); `failAlways` makes every call
 *   reject; `clearFailures()` resets. A call that "fails" is still COUNTED
 *   (it was attempted) but mints NO child.
 * - **Call / creation accounting** for the "no double effect" assertions:
 *   `createCalls` counts every attempted call; `childrenCreated` counts
 *   children actually minted. A re-drive of a stage whose external effect
 *   already completed (child id durably recorded) must NOT increase
 *   `createCalls` at all (the coordinator skips the adapter), and must
 *   never increase `childrenCreated` past one per member.
 *
 * @module @dsh-agent-team/storage/provisioning/fake-adapter
 */
import type { ChildSessionId } from '../../contracts/src/index.js';
import type { AgentFactoryAdapter, CreateChildSessionRequest, CreateChildSessionResult } from './adapter.js';
/**
 * The typed error the fake raises when a call is scripted to fail. Branch
 * on `error.name === 'FakeAdapterError'` (or use {@link isFakeAdapterError});
 * never on the message.
 */
export declare class FakeAdapterError extends Error {
    constructor(message: string);
}
/** Type guard for {@link FakeAdapterError}. */
export declare function isFakeAdapterError(error: unknown): error is FakeAdapterError;
/**
 * One deterministic in-memory AgentFactoryAdapter.
 */
export declare class FakeAgentFactoryAdapter implements AgentFactoryAdapter {
    /** member key -> durable child session id (the factory's allocation map). */
    private readonly children;
    /** Every attempted `createChildSession` call (including scripted failures). */
    createCalls: number;
    /** Children actually minted (one per member, at most). */
    childrenCreated: number;
    /** Number of the NEXT calls scripted to fail. */
    private failRemaining;
    /** When true, every call fails (until {@link clearFailures}). */
    private failAlways;
    /**
     * Script the next `n` calls to reject with {@link FakeAdapterError}.
     * @param n - the number of upcoming calls to fail (>= 0).
     */
    failNext(n: number): void;
    /** Make every subsequent call reject (until {@link clearFailures}). */
    failAlwaysFail(): void;
    /** Reset all scripted failures. */
    clearFailures(): void;
    /** The durable child session id the fake has allocated for one member, if any. */
    childSessionIdFor(rootSessionId: string, instanceId: string): ChildSessionId | undefined;
    /** The number of distinct members this fake has minted a child for. */
    get memberCount(): number;
    createChildSession(request: CreateChildSessionRequest): Promise<CreateChildSessionResult>;
}
//# sourceMappingURL=fake-adapter.d.ts.map