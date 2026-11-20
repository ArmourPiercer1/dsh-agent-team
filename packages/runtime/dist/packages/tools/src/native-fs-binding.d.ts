/**
 * UTE-1 — native FS binding: a reviewed product-side module for the alpha.5
 * native FS lane.
 *
 * WHAT THIS IS. A provider class that subclasses the host's own filesystem
 * provider (never a copy of it) and adds exactly ONE decision in front of every
 * target-bearing operation: the binding's declared read/write LANE. Every
 * admitted call delegates to `super.<method>`, so the effect is the host's own
 * effect — atomic publication, version guards, diff bases, symlink handling and
 * byte I/O are not re-implemented here.
 *
 * WHAT THIS IS NOT.
 *   - It makes no authorisation, approval or policy decision. The lane is a
 *     SERVICE-level containment bound; Alpha.4's authority/approval kernel and
 *     the P1 `EffectiveIo` compiler remain the only permission decision makers.
 *   - It is not wired into any shipped assembly. Nothing in `packages/runtime`
 *     (or any other product entry) imports this module; the barrel export in
 *     `./index.ts` is the only reference, and it is additive.
 *   - It does not route production traffic, does not replace the governed
 *     route-C path and does not delete or modify any existing path.
 *
 * WHY THE BINDING OWNS A SCOPE (UTE-1 §3), AND WHAT DISPOSAL MEANS.
 * A binding has an explicit, monotonic lifetime:
 *
 *     active ──dispose()──► draining ──drain complete + release resolved──► released
 *                                    └──timeout, or a release step failed──► termination-unconfirmed
 *
 * Three facts that used to be conflated are now three receipt fields, because a
 * caller who needs one of them must not have to infer the other two:
 *
 *   - `newOperationsRefused` — a call arriving after `dispose()` started is
 *     refused by name: `scope-draining` while draining, `scope-disposed` after
 *     `released`, `scope-termination-unconfirmed` after an unconfirmed stop.
 *     This is the one thing this binding proves about FUTURE work.
 *   - `drained` — every operation the binding ADMITTED has finished (success,
 *     throw, or a refusal after admission) before the receipt was produced.
 *     `dispose()` waits for that up to `drainTimeoutMs`.
 *   - `releaseConfirmed` — the tools/provider fibers this mount created were
 *     disposed and none of those disposals threw. Only `released` may claim it.
 *
 * RESPONSIBILITY BOUNDARY (contract, not a caveat). This binding owns exactly
 * two things: (a) refusing new operations once disposal starts, and (b) counting
 * and draining the operations it admitted. Terminating a provider that will not
 * drain is the HOST/lifecycle owner's job unless that provider honours the
 * injected abort signal; this binding does not kill fibers out from under a
 * parked call. Correspondingly, a Scope receipt is evidence ABOUT THE BINDING —
 * never proof that an OS effect did not happen. `drained: true` says the
 * admitted promise-shaped operations returned; it does not say the kernel did
 * nothing, and it does not cover a stream that outlives its iterator, a watch
 * registration, or any effect started by code the binding did not admit.
 *
 * DOUBLE DISPOSE IS IDEMPOTENT AND TERMINAL. The first call performs the
 * transition and memoises its receipt; every later call returns the SAME
 * terminal facts with `changed:false, alreadyDisposed:true`. A binding that
 * ended `termination-unconfirmed` never later reports `released`.
 *
 * The scope is also the only place the binding's lane lives: two overlapping
 * scopes never share a lane, and replacing a scope's provider never resurrects
 * the previous lane.
 *
 * HOST GENERATION IS PINNED AT MOUNT. `mountNativeFsBinding` records the host
 * generation the caller expects and refuses a different one by name
 * (`FS_BINDING_HOST_GENERATION_MISMATCH`). It never falls back to another host
 * tree — resolution belongs to the caller, and a substitution is exactly the
 * failure mode the pinned-generation check exists to prevent.
 *
 * DISCLOSED LIMITS (carried forward from the G1-S1 prototype, not resolved
 * here): read confinement is NOT claimed (an effect/refusal oracle cannot prove
 * the absence of a read syscall); delete/move have no old-path vector to be
 * equivalent to; streaming windows, byte-range reads and `read_image` are not
 * exercised; and the lane refusal code stays `FS_PERMISSION_DENIED` because the
 * rc.5 `tool-fs` dereferences `policy.mode` for `FS_SANDBOX_DENIED` (see
 * `tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md`, KNOWN-SEMANTIC-DIFFERENCE
 * 1–2, both still retirement-blocking).
 *
 * The module is deliberately dependency-free (no imports at all): it declares
 * the small structural surface it needs, so it adds no package dependency, no
 * lockfile change and no host import to the `tools` package.
 *
 * @module @dsh-agent-team/tools/native-fs-binding
 */
/**
 * The module identity line, quoted by evidence. A change here is a change to
 * what the evidence claims and must be reviewed with it.
 */
export declare const NATIVE_FS_BINDING_MODULE_ID = "native-fs-binding/1";
/** The fact schema every lane/scope decision is recorded with. */
export declare const NATIVE_FS_BINDING_FACT_SCHEMA = "native-fs-binding-fact/1";
/**
 * The closed refusal vocabulary this module produces. These are BEHAVIOURAL
 * classes (what was refused), not host error codes: the host code is the
 * transport the model sees, the refusal class is what a reviewer compares.
 */
export declare const FS_BINDING_REFUSAL: Readonly<{
    /** The resolved target is outside every read root of the binding. */
    readonly LANE_READ: "lane-read";
    /** The resolved target is outside every write root of the binding. */
    readonly LANE_WRITE: "lane-write";
    /** A mutation of an existing target that the read axis does not cover. */
    readonly WRITE_REQUIRES_READ: "write-requires-read";
    /** The binding's scope is DRAINING: disposal started, admitted work is unfinished. */
    readonly SCOPE_DRAINING: "scope-draining";
    /** The binding's scope is released; the operation is refused by name. */
    readonly SCOPE_DISPOSED: "scope-disposed";
    /** The binding's scope stopped with `termination-unconfirmed`; refuse by that name. */
    readonly SCOPE_TERMINATION_UNCONFIRMED: "scope-termination-unconfirmed";
    /** The provider instance does not belong to a live binding scope. */
    readonly SCOPE_UNKNOWN: "scope-unknown";
}>;
/** One member of {@link FS_BINDING_REFUSAL}. */
export type FsBindingRefusal = (typeof FS_BINDING_REFUSAL)[keyof typeof FS_BINDING_REFUSAL];
/**
 * The binding lifecycle. `active` is the only state in which I/O is admitted;
 * `draining` refuses new work while admitted work finishes; the two terminal
 * states are `released` (drain + release confirmed) and `termination-unconfirmed`
 * (drain timed out, or a release step threw — the provider was NOT terminated).
 */
export type FsBindingStatus = 'active' | 'draining' | 'released' | 'termination-unconfirmed';
/** The terminal states a disposal receipt can report. */
export type FsBindingTerminalState = 'released' | 'termination-unconfirmed';
/** A binding's declared lane: canonical absolute roots per axis. */
export interface FsBindingLane {
    readonly read: readonly string[];
    readonly write: readonly string[];
}
/** One recorded decision (allow or deny), in call order. */
export interface NativeFsBindingFact {
    readonly schema: typeof NATIVE_FS_BINDING_FACT_SCHEMA;
    readonly bindingId: string;
    readonly generation: string;
    readonly method: string;
    readonly axis: 'read' | 'write';
    /** The provider-resolved canonical host path the decision was made on. */
    readonly path: string;
    readonly decision: 'allow' | 'deny';
    readonly refusal: FsBindingRefusal | null;
    readonly laneRead: readonly string[];
    readonly laneWrite: readonly string[];
}
/** The typed error a mount/scope contract violation raises (never an I/O error). */
export declare class NativeFsBindingError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: {
        readonly cause?: unknown;
    });
}
/** The structural error class the host provider throws (`FsError`). */
export interface FsErrorLike extends Error {
    readonly code?: string;
}
/** Constructor shape of the host's typed filesystem error. */
export type FsErrorConstructor = new (message: string, code: string, options?: {
    readonly cause?: unknown;
}) => FsErrorLike;
/**
 * The abort surface a host provider accepts, declared STRUCTURALLY.
 *
 * WHY NOT THE DOM `AbortSignal`. This package's production compile face is
 * `tsconfig.build.json` (the census runs `tsc -p tsconfig.build.json`), and it
 * compiles `src` alone with `lib: ["ES2022"]` — no DOM lib and no ambient node
 * types. Naming the global `AbortSignal` there is `TS2304: Cannot find name
 * 'AbortSignal'`, even though `tsc -p tsconfig.json --noEmit` accepts it: that
 * config also includes `test` + `vitest.config.ts`, whose types pull the DOM
 * lib in. The two commands are NOT the same check, and the build one is the
 * one that ships. Declaring the smallest surface this binding actually needs
 * (`aborted`) keeps the module free of ambient globals; a real
 * `AbortController.signal` satisfies it, so host call sites are unchanged, and
 * the binding only forwards the value to the host provider — it never
 * subscribes. Event methods are deliberately not modelled: requiring them
 * would add a second, weaker copy of the DOM signature for no consumer.
 */
export interface AbortSignalLike {
    readonly aborted: boolean;
    readonly reason?: unknown;
}
/**
 * The structural host provider surface this module relies on. It is declared
 * here (not imported) so the `tools` package gains no host dependency; every
 * member is the host provider's own published method.
 */
export interface NativeFileSystemSurface {
    readonly config?: {
        readonly cwd?: string;
    };
    resolve(path: string, opts?: unknown): Promise<unknown>;
    processPath(target: unknown): string;
    contains(parent: unknown, child: unknown): boolean;
    stat(target: unknown, signal?: AbortSignalLike): Promise<unknown>;
    lstat(path: string, opts?: unknown, signal?: AbortSignalLike): Promise<unknown>;
    readText(target: unknown, signal?: AbortSignalLike): Promise<string>;
    streamText(target: unknown, signal?: AbortSignalLike): Promise<AsyncIterable<string>>;
    readBytes(target: unknown, signal: AbortSignalLike | undefined, maxBytes: number): Promise<Uint8Array>;
    readByteRange(target: unknown, range: unknown, signal?: AbortSignalLike): Promise<Uint8Array>;
    listDir(target: unknown, signal?: AbortSignalLike): Promise<readonly unknown[]>;
    watch(target: unknown, changed: (error?: Error) => void, signal: AbortSignalLike): Promise<() => Promise<void>>;
    writeText(target: unknown, content: string, expected?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>;
    editText(target: unknown, edit: unknown, expected?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>;
    patchText(target: unknown, hunks: unknown, expected?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>;
    deleteFile(target: unknown, expected?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>;
    moveFile(source: unknown, destination: unknown, options?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>;
}
/** Constructor shape of the host provider class the lane subclasses. */
export type NativeFileSystemConstructor = new (ctx: unknown, config?: Record<string, unknown>) => NativeFileSystemSurface;
/** The plugin surface the host's native FS tool module exposes. */
export interface NativeFsToolModule {
    readonly name?: string;
    readonly inject?: unknown;
    readonly apply?: (...args: readonly unknown[]) => unknown;
}
/**
 * The host surface a binding mounts against. Only PUBLIC entries: the provider
 * class, its typed error, the native tool module and a generation stamp the
 * caller read from its own pin.
 */
export interface NativeFsBindingHost {
    readonly generation: string;
    readonly LocalFileSystem: NativeFileSystemConstructor;
    readonly FsError: FsErrorConstructor;
    readonly toolFs: NativeFsToolModule;
}
/** The minimal Cordis context surface the mount needs (public scope primitives). */
export interface NativeFsBindingContext {
    isolate(name: string): {
        plugin(plugin: unknown, config?: unknown): Promise<{
            dispose(): Promise<void>;
        }>;
        get(name: string): unknown;
    };
}
/**
 * The disposal receipt: three separable facts, never one implied by another.
 *
 * `state === 'released'` is the ONLY shape that may be read as "the binding is
 * stopped and its resources are gone". `drained` speaks about admitted
 * operations; `releaseConfirmed` speaks about the fibers; `newOperationsRefused`
 * speaks about calls that arrive later. A receipt is evidence about the binding,
 * never proof that an OS effect did not happen (see the module header).
 */
export interface NativeFsBindingDisposal {
    readonly bindingId: string;
    /** The terminal lifecycle state of the binding. */
    readonly state: FsBindingTerminalState;
    /** True when this call performed the transition; false on a repeat call. */
    readonly changed: boolean;
    /** True when a repeat call returned the memoised terminal facts. */
    readonly alreadyDisposed: boolean;
    /** True iff every operation ADMITTED before disposal finished before the receipt. */
    readonly drained: boolean;
    /** True iff new operations are refused after this transition (always true here). */
    readonly newOperationsRefused: boolean;
    /** True iff `state === 'released'` AND the release step resolved without error. */
    readonly releaseConfirmed: boolean;
    /** The refusal class a NEW operation would receive now. */
    readonly refusalCode: string;
    /** Why the binding reached this state (for `termination-unconfirmed`: the cause). */
    readonly reason: string;
    readonly disposedAt: string;
    /** Operations admitted but unfinished at the moment `dispose()` started. */
    readonly inFlightAtDispose: number;
    /** The bound this disposal waited for the drain (milliseconds). */
    readonly drainTimeoutMs: number;
    /** Errors thrown by release steps, in attempt order (empty on a confirmed release). */
    readonly releaseErrors: readonly string[];
}
/**
 * A binding SCOPE: the lane + lifecycle state + the provider class that reads
 * them. Created by {@link createNativeFsBindingScope}; the class may be handed
 * to a real product assembly as its `providerClass`, and disposing the scope
 * refuses every later operation by name even while the fiber still exists.
 */
export interface NativeFsBindingScope {
    readonly id: string;
    readonly generation: string;
    readonly lane: FsBindingLane;
    readonly providerClass: NativeFileSystemConstructor;
    readonly status: FsBindingStatus;
    /** Operations admitted but not yet finished (0 when `active` and idle). */
    readonly inFlight: number;
    /** Every LANE decision so far, in call order (evidence only; lifecycle refusals are not facts). */
    readonly facts: readonly NativeFsBindingFact[];
    /** Throw the named lifecycle refusal unless the scope is `active`. */
    assertLive(operation: string): void;
    /**
     * Dispose the SCOPE: refuse new work, drain admitted work up to
     * `drainTimeoutMs`, then (when a release handler is supplied) release.
     * Idempotent and terminal — a repeat returns the memoised terminal facts.
     */
    dispose(reason?: string, release?: () => Promise<void>): Promise<NativeFsBindingDisposal>;
}
/** Options for {@link createNativeFsBindingScope}. */
export interface CreateNativeFsBindingScopeInput {
    readonly id: string;
    readonly generation: string;
    readonly lane: FsBindingLane;
    readonly Base: NativeFileSystemConstructor;
    readonly FsError: FsErrorConstructor;
    /**
     * DIAGNOSTIC-ONLY recorder, called once per LANE decision.
     *
     * Its failure is swallowed on purpose: a diagnostic sink must never change
     * what the binding decides. It is therefore NOT a settlement channel — do not
     * use it as (or in place of) the S1 durable-settlement writer, whose failures
     * MUST be fatal to the operation that depends on them. See the module header.
     */
    readonly record?: (fact: NativeFsBindingFact) => void;
    /** Optional label used in refusal messages (defaults to {@link NATIVE_FS_BINDING_MODULE_ID}). */
    readonly label?: string;
    /** How long `dispose()` waits for admitted operations before declaring `termination-unconfirmed`. */
    readonly drainTimeoutMs?: number;
}
/** Options for {@link mountNativeFsBinding}. */
export interface MountNativeFsBindingInput {
    readonly ctx: NativeFsBindingContext;
    readonly host: NativeFsBindingHost;
    readonly lane: FsBindingLane;
    /** The generation this caller pinned; a different host is refused by name. */
    readonly expectedGeneration: string;
    readonly id?: string;
    readonly cwd?: string;
    /** Config forwarded verbatim to the native tool module. */
    readonly toolConfig?: Record<string, unknown>;
    /**
     * DIAGNOSTIC-ONLY recorder (see {@link CreateNativeFsBindingScopeInput.record}):
     * swallowed on failure, never the S1 durable-settlement path.
     */
    readonly record?: (fact: NativeFsBindingFact) => void;
    readonly label?: string;
    /** How long `dispose()` waits for admitted operations (default 5_000 ms). */
    readonly drainTimeoutMs?: number;
}
/**
 * The mounted binding: a scope plus the fibers its mount created. `dispose` is
 * ASYNC here (it awaits the fibers after closing the scope), so this is a
 * separate declaration rather than `extends NativeFsBindingScope`.
 */
export interface NativeFsBinding {
    readonly id: string;
    readonly generation: string;
    readonly lane: FsBindingLane;
    readonly providerClass: NativeFileSystemConstructor;
    /** The provider instance the isolated scope resolved (`ctx.get('fs')`). */
    readonly provider: NativeFileSystemSurface;
    readonly providerMounted: boolean;
    readonly toolMounted: boolean;
    readonly status: FsBindingStatus;
    /** Operations admitted but not yet finished (0 when `active` and idle). */
    readonly inFlight: number;
    /** Every LANE decision so far, in call order (evidence only). */
    readonly facts: readonly NativeFsBindingFact[];
    /** Throw the named lifecycle refusal unless the scope is `active`. */
    assertLive(operation: string): void;
    /** Drain admitted work, tear the fibers down, and dispose the scope. Idempotent. */
    dispose(reason?: string): Promise<NativeFsBindingDisposal>;
}
/**
 * Normalize declared lane roots to a frozen, de-duplicated, absolute list.
 * A non-array, an empty string or a non-string root is a contract violation:
 * a lane that silently becomes `[]` would be a denial, never an allow, but it
 * would also hide a caller bug, so it is refused at construction.
 *
 * @param roots - declared roots (absolute or relative to `base`).
 * @param base - base for relative roots.
 * @returns frozen absolute roots.
 */
export declare function normalizeLaneRoots(roots: readonly string[], base: string): readonly string[];
/** Public predicate: does the axis admit the (already resolved) host path? */
export declare function laneAdmits(roots: readonly string[], hostPath: string): boolean;
/**
 * Create one binding SCOPE and its confined provider class.
 *
 * The class never re-implements the host provider: each guarded method asks the
 * scope for admission, then calls `super.<method>`. Admission is evaluated on
 * `this.processPath(target)` — the provider-resolved canonical host path — so an
 * in-lane symlink pointing outside the lane is refused on the resolved path.
 *
 * @param input - scope id/generation/lane, the host provider base and error.
 * @returns the scope object (with `providerClass`).
 */
export declare function createNativeFsBindingScope(input: CreateNativeFsBindingScopeInput): NativeFsBindingScope;
/**
 * Mount a binding on an isolated `fs` scope, with the host's own native FS tool
 * module re-mounted on that same scope.
 *
 * The mount is all-or-nothing: a failure disposes whatever was created and
 * re-throws, and the scope is disposed so a half-mounted binding cannot serve.
 *
 * @param input - context, host surface, lane, pinned generation.
 * @returns the mounted binding; carry `dispose()` on the owner.
 */
export declare function mountNativeFsBinding(input: MountNativeFsBindingInput): Promise<NativeFsBinding>;
//# sourceMappingURL=native-fs-binding.d.ts.map