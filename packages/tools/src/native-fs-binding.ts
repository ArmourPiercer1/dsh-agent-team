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
export const NATIVE_FS_BINDING_MODULE_ID = 'native-fs-binding/1'

/** The fact schema every lane/scope decision is recorded with. */
export const NATIVE_FS_BINDING_FACT_SCHEMA = 'native-fs-binding-fact/1'

/**
 * The closed refusal vocabulary this module produces. These are BEHAVIOURAL
 * classes (what was refused), not host error codes: the host code is the
 * transport the model sees, the refusal class is what a reviewer compares.
 */
export const FS_BINDING_REFUSAL = Object.freeze({
  /** The resolved target is outside every read root of the binding. */
  LANE_READ: 'lane-read',
  /** The resolved target is outside every write root of the binding. */
  LANE_WRITE: 'lane-write',
  /** A mutation of an existing target that the read axis does not cover. */
  WRITE_REQUIRES_READ: 'write-requires-read',
  /** The binding's scope is DRAINING: disposal started, admitted work is unfinished. */
  SCOPE_DRAINING: 'scope-draining',
  /** The binding's scope is released; the operation is refused by name. */
  SCOPE_DISPOSED: 'scope-disposed',
  /** The binding's scope stopped with `termination-unconfirmed`; refuse by that name. */
  SCOPE_TERMINATION_UNCONFIRMED: 'scope-termination-unconfirmed',
  /** The provider instance does not belong to a live binding scope. */
  SCOPE_UNKNOWN: 'scope-unknown',
} as const)

/** One member of {@link FS_BINDING_REFUSAL}. */
export type FsBindingRefusal = (typeof FS_BINDING_REFUSAL)[keyof typeof FS_BINDING_REFUSAL]

/**
 * The binding lifecycle. `active` is the only state in which I/O is admitted;
 * `draining` refuses new work while admitted work finishes; the two terminal
 * states are `released` (drain + release confirmed) and `termination-unconfirmed`
 * (drain timed out, or a release step threw — the provider was NOT terminated).
 */
export type FsBindingStatus = 'active' | 'draining' | 'released' | 'termination-unconfirmed'

/** The terminal states a disposal receipt can report. */
export type FsBindingTerminalState = 'released' | 'termination-unconfirmed'

/** A binding's declared lane: canonical absolute roots per axis. */
export interface FsBindingLane {
  readonly read: readonly string[]
  readonly write: readonly string[]
}

/** One recorded decision (allow or deny), in call order. */
export interface NativeFsBindingFact {
  readonly schema: typeof NATIVE_FS_BINDING_FACT_SCHEMA
  readonly bindingId: string
  readonly generation: string
  readonly method: string
  readonly axis: 'read' | 'write'
  /** The provider-resolved canonical host path the decision was made on. */
  readonly path: string
  readonly decision: 'allow' | 'deny'
  readonly refusal: FsBindingRefusal | null
  readonly laneRead: readonly string[]
  readonly laneWrite: readonly string[]
}

/** The typed error a mount/scope contract violation raises (never an I/O error). */
export class NativeFsBindingError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: { readonly cause?: unknown }) {
    super(message, options)
    this.name = 'NativeFsBindingError'
    this.code = code
  }
}

/** The structural error class the host provider throws (`FsError`). */
export interface FsErrorLike extends Error {
  readonly code?: string
}

/** Constructor shape of the host's typed filesystem error. */
export type FsErrorConstructor =
  new (message: string, code: string, options?: { readonly cause?: unknown }) => FsErrorLike

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
  readonly aborted: boolean
  readonly reason?: unknown
}

/**
 * The structural host provider surface this module relies on. It is declared
 * here (not imported) so the `tools` package gains no host dependency; every
 * member is the host provider's own published method.
 */
export interface NativeFileSystemSurface {
  readonly config?: { readonly cwd?: string }
  resolve(path: string, opts?: unknown): Promise<unknown>
  processPath(target: unknown): string
  contains(parent: unknown, child: unknown): boolean
  stat(target: unknown, signal?: AbortSignalLike): Promise<unknown>
  lstat(path: string, opts?: unknown, signal?: AbortSignalLike): Promise<unknown>
  readText(target: unknown, signal?: AbortSignalLike): Promise<string>
  streamText(target: unknown, signal?: AbortSignalLike): Promise<AsyncIterable<string>>
  readBytes(target: unknown, signal: AbortSignalLike | undefined, maxBytes: number): Promise<Uint8Array>
  readByteRange(target: unknown, range: unknown, signal?: AbortSignalLike): Promise<Uint8Array>
  listDir(target: unknown, signal?: AbortSignalLike): Promise<readonly unknown[]>
  watch(target: unknown, changed: (error?: Error) => void, signal: AbortSignalLike): Promise<() => Promise<void>>
  writeText(
    target: unknown,
    content: string,
    expected?: unknown,
    signal?: AbortSignalLike,
    sandboxPolicy?: unknown,
  ): Promise<unknown>
  editText(target: unknown, edit: unknown, expected?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>
  patchText(target: unknown, hunks: unknown, expected?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>
  deleteFile(target: unknown, expected?: unknown, signal?: AbortSignalLike, sandboxPolicy?: unknown): Promise<unknown>
  moveFile(
    source: unknown,
    destination: unknown,
    options?: unknown,
    signal?: AbortSignalLike,
    sandboxPolicy?: unknown,
  ): Promise<unknown>
}

/** Constructor shape of the host provider class the lane subclasses. */
export type NativeFileSystemConstructor =
  new (ctx: unknown, config?: Record<string, unknown>) => NativeFileSystemSurface

/** The plugin surface the host's native FS tool module exposes. */
export interface NativeFsToolModule {
  readonly name?: string
  readonly inject?: unknown
  readonly apply?: (...args: readonly unknown[]) => unknown
}

/**
 * The host surface a binding mounts against. Only PUBLIC entries: the provider
 * class, its typed error, the native tool module and a generation stamp the
 * caller read from its own pin.
 */
export interface NativeFsBindingHost {
  readonly generation: string
  readonly LocalFileSystem: NativeFileSystemConstructor
  readonly FsError: FsErrorConstructor
  readonly toolFs: NativeFsToolModule
}

/** The minimal Cordis context surface the mount needs (public scope primitives). */
export interface NativeFsBindingContext {
  isolate(name: string): {
    plugin(plugin: unknown, config?: unknown): Promise<{ dispose(): Promise<void> }>
    get(name: string): unknown
  }
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
  readonly bindingId: string
  /** The terminal lifecycle state of the binding. */
  readonly state: FsBindingTerminalState
  /** True when this call performed the transition; false on a repeat call. */
  readonly changed: boolean
  /** True when a repeat call returned the memoised terminal facts. */
  readonly alreadyDisposed: boolean
  /** True iff every operation ADMITTED before disposal finished before the receipt. */
  readonly drained: boolean
  /** True iff new operations are refused after this transition (always true here). */
  readonly newOperationsRefused: boolean
  /** True iff `state === 'released'` AND the release step resolved without error. */
  readonly releaseConfirmed: boolean
  /** The refusal class a NEW operation would receive now. */
  readonly refusalCode: string
  /** Why the binding reached this state (for `termination-unconfirmed`: the cause). */
  readonly reason: string
  readonly disposedAt: string
  /** Operations admitted but unfinished at the moment `dispose()` started. */
  readonly inFlightAtDispose: number
  /** The bound this disposal waited for the drain (milliseconds). */
  readonly drainTimeoutMs: number
  /** Errors thrown by release steps, in attempt order (empty on a confirmed release). */
  readonly releaseErrors: readonly string[]
}

/**
 * A binding SCOPE: the lane + lifecycle state + the provider class that reads
 * them. Created by {@link createNativeFsBindingScope}; the class may be handed
 * to a real product assembly as its `providerClass`, and disposing the scope
 * refuses every later operation by name even while the fiber still exists.
 */
export interface NativeFsBindingScope {
  readonly id: string
  readonly generation: string
  readonly lane: FsBindingLane
  readonly providerClass: NativeFileSystemConstructor
  readonly status: FsBindingStatus
  /** Operations admitted but not yet finished (0 when `active` and idle). */
  readonly inFlight: number
  /** Every LANE decision so far, in call order (evidence only; lifecycle refusals are not facts). */
  readonly facts: readonly NativeFsBindingFact[]
  /** Throw the named lifecycle refusal unless the scope is `active`. */
  assertLive(operation: string): void
  /**
   * Dispose the SCOPE: refuse new work, drain admitted work up to
   * `drainTimeoutMs`, then (when a release handler is supplied) release.
   * Idempotent and terminal — a repeat returns the memoised terminal facts.
   */
  dispose(reason?: string, release?: () => Promise<void>): Promise<NativeFsBindingDisposal>
}

/** Options for {@link createNativeFsBindingScope}. */
export interface CreateNativeFsBindingScopeInput {
  readonly id: string
  readonly generation: string
  readonly lane: FsBindingLane
  readonly Base: NativeFileSystemConstructor
  readonly FsError: FsErrorConstructor
  /**
   * DIAGNOSTIC-ONLY recorder, called once per LANE decision.
   *
   * Its failure is swallowed on purpose: a diagnostic sink must never change
   * what the binding decides. It is therefore NOT a settlement channel — do not
   * use it as (or in place of) the S1 durable-settlement writer, whose failures
   * MUST be fatal to the operation that depends on them. See the module header.
   */
  readonly record?: (fact: NativeFsBindingFact) => void
  /** Optional label used in refusal messages (defaults to {@link NATIVE_FS_BINDING_MODULE_ID}). */
  readonly label?: string
  /** How long `dispose()` waits for admitted operations before declaring `termination-unconfirmed`. */
  readonly drainTimeoutMs?: number
}

/** Options for {@link mountNativeFsBinding}. */
export interface MountNativeFsBindingInput {
  readonly ctx: NativeFsBindingContext
  readonly host: NativeFsBindingHost
  readonly lane: FsBindingLane
  /** The generation this caller pinned; a different host is refused by name. */
  readonly expectedGeneration: string
  readonly id?: string
  readonly cwd?: string
  /** Config forwarded verbatim to the native tool module. */
  readonly toolConfig?: Record<string, unknown>
  /**
   * DIAGNOSTIC-ONLY recorder (see {@link CreateNativeFsBindingScopeInput.record}):
   * swallowed on failure, never the S1 durable-settlement path.
   */
  readonly record?: (fact: NativeFsBindingFact) => void
  readonly label?: string
  /** How long `dispose()` waits for admitted operations (default 5_000 ms). */
  readonly drainTimeoutMs?: number
}

/**
 * The mounted binding: a scope plus the fibers its mount created. `dispose` is
 * ASYNC here (it awaits the fibers after closing the scope), so this is a
 * separate declaration rather than `extends NativeFsBindingScope`.
 */
export interface NativeFsBinding {
  readonly id: string
  readonly generation: string
  readonly lane: FsBindingLane
  readonly providerClass: NativeFileSystemConstructor
  /** The provider instance the isolated scope resolved (`ctx.get('fs')`). */
  readonly provider: NativeFileSystemSurface
  readonly providerMounted: boolean
  readonly toolMounted: boolean
  readonly status: FsBindingStatus
  /** Operations admitted but not yet finished (0 when `active` and idle). */
  readonly inFlight: number
  /** Every LANE decision so far, in call order (evidence only). */
  readonly facts: readonly NativeFsBindingFact[]
  /** Throw the named lifecycle refusal unless the scope is `active`. */
  assertLive(operation: string): void
  /** Drain admitted work, tear the fibers down, and dispose the scope. Idempotent. */
  dispose(reason?: string): Promise<NativeFsBindingDisposal>
}

/** Reserved: the host code a lane refusal carries (see the module header). */
const LANE_REFUSAL_CODE = 'FS_PERMISSION_DENIED'

/**
 * Timers, read OFF `globalThis` through a local structural cast.
 *
 * WHY: this module compiles under `lib: ["ES2022"]` with no DOM and no ambient
 * node types, so the bare identifiers `setTimeout`/`clearTimeout` are TS2304
 * there (the same class of defect as the earlier `AbortSignal` one). Reading
 * them as properties of `globalThis` adds no ambient name, keeps the module
 * dependency-free, and degrades to "no bound" only in a runner that has no
 * timers at all — in which case the drain waits exactly as long as the work.
 */
const TIMERS = globalThis as unknown as {
  setTimeout?: (handler: () => void, timeoutMs?: number) => unknown
  clearTimeout?: (handle: unknown) => void
}
/** Reserved: the host code a write-without-read refusal carries. */
const WRITE_REQUIRES_READ_CODE = 'FS_NOT_OBSERVED'

/** Is `child` the root or beneath it? Lexical, `..`-escaping, never absolute. */
function withinRoot(root: string, child: string): boolean {
  if (child === root) return true
  const prefix = root.endsWith('/') ? root : `${root}/`
  return child.startsWith(prefix) && !child.slice(prefix.length).startsWith('..')
}

/** Is `hostPath` inside ANY root of the axis? Empty axis ⇒ nothing is inside. */
function withinAny(roots: readonly string[], hostPath: string): boolean {
  for (const root of roots) {
    if (withinRoot(root, hostPath)) return true
  }
  return false
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
export function normalizeLaneRoots(roots: readonly string[], base: string): readonly string[] {
  if (!Array.isArray(roots)) {
    throw new NativeFsBindingError(
      'FS_BINDING_LANE_INVALID',
      `a lane axis must be an array of roots, got ${typeof roots}`,
    )
  }
  const seen = new Set<string>()
  for (const root of roots) {
    if (typeof root !== 'string' || root.trim().length === 0) {
      throw new NativeFsBindingError(
        'FS_BINDING_LANE_INVALID',
        `a lane root must be a non-empty string, got ${JSON.stringify(root)}`,
      )
    }
    const absolute = root.startsWith('/') ? root : joinPath(base, root)
    seen.add(normalizePath(absolute))
  }
  return Object.freeze([...seen])
}

/** Lexical path join that keeps the module dependency-free (`node:path` is not used). */
function joinPath(base: string, path: string): string {
  if (base.endsWith('/')) return `${base}${path}`
  return `${base}/${path}`
}

/** Lexical normalization: collapse `.`/duplicate separators and resolve `..` segments. */
function normalizePath(path: string): string {
  const absolute = path.startsWith('/')
  const out: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else if (!absolute) out.push('..')
      continue
    }
    out.push(segment)
  }
  return `${absolute ? '/' : ''}${out.join('/')}` || (absolute ? '/' : '.')
}

/** Public predicate: does the axis admit the (already resolved) host path? */
export function laneAdmits(roots: readonly string[], hostPath: string): boolean {
  return withinAny(roots, hostPath)
}

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
export function createNativeFsBindingScope(input: CreateNativeFsBindingScopeInput): NativeFsBindingScope {
  const { id, generation, Base, FsError } = input
  if (typeof Base !== 'function') {
    throw new NativeFsBindingError('FS_BINDING_HOST_SURFACE_INCOMPLETE', 'a provider base class is required')
  }
  if (typeof FsError !== 'function') {
    throw new NativeFsBindingError('FS_BINDING_HOST_SURFACE_INCOMPLETE', 'the host FsError class is required')
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new NativeFsBindingError('FS_BINDING_SCOPE_INVALID', 'a binding id must be a non-empty string')
  }
  if (typeof generation !== 'string' || generation.trim().length === 0) {
    throw new NativeFsBindingError('FS_BINDING_HOST_SURFACE_INCOMPLETE', 'a host generation stamp is required')
  }
  const label = input.label ?? NATIVE_FS_BINDING_MODULE_ID
  const record = input.record ?? ((): void => undefined)
  const base = input.lane as { readonly read?: unknown; readonly write?: unknown } | undefined
  if (base?.read === undefined || base.write === undefined) {
    throw new NativeFsBindingError('FS_BINDING_LANE_INVALID', 'a lane needs both a read and a write axis')
  }
  const lane: FsBindingLane = Object.freeze({
    read: Object.freeze([...(base.read as readonly string[])]),
    write: Object.freeze([...(base.write as readonly string[])]),
  })

  const facts: NativeFsBindingFact[] = []
  /** How long disposal waits for admitted work before it stops confirming. */
  const DEFAULT_DRAIN_TIMEOUT_MS = 5_000
  const drainTimeoutMs = typeof input.drainTimeoutMs === 'number' && Number.isFinite(input.drainTimeoutMs)
    ? Math.max(0, input.drainTimeoutMs)
    : DEFAULT_DRAIN_TIMEOUT_MS
  /**
   * Mutable lifecycle state, closed over by the class (never a private field):
   * the admission guard reads it synchronously, and the in-flight counter is the
   * ONLY thing disposal waits on.
   */
  const state = {
    status: 'active' as FsBindingStatus,
    reason: 'active',
    disposedAt: null as string | null,
    inFlight: 0,
    inFlightAtDispose: 0,
    receipt: null as NativeFsBindingDisposal | null,
    drainWaiters: [] as Array<() => void>,
  }

  function pushFact(method: string, axis: 'read' | 'write', path: string, refusal: FsBindingRefusal | null): void {
    const fact: NativeFsBindingFact = Object.freeze({
      schema: NATIVE_FS_BINDING_FACT_SCHEMA,
      bindingId: id,
      generation,
      method,
      axis,
      path,
      decision: refusal === null ? 'allow' : 'deny',
      refusal,
      laneRead: lane.read,
      laneWrite: lane.write,
    })
    facts.push(fact)
    try {
      record(fact)
    } catch {
      // A recorder is evidence only; its failure must not change a decision.
    }
  }

  function refuse(method: string, axis: 'read' | 'write', path: string, refusal: FsBindingRefusal): never {
    pushFact(method, axis, path, refusal)
    const code = refusal === FS_BINDING_REFUSAL.WRITE_REQUIRES_READ ? WRITE_REQUIRES_READ_CODE : LANE_REFUSAL_CODE
    throw new FsError(
      `${label}: ${refusal} — '${method}' on ${JSON.stringify(path)} is outside the declared ${axis} lane`
        + ` (binding ${JSON.stringify(id)}, host ${JSON.stringify(generation)})`,
      code,
    )
  }

  /** The refusal a NEW operation receives in the current lifecycle state. */
  function lifecycleRefusal(): FsBindingRefusal | null {
    if (state.status === 'active') return null
    if (state.status === 'draining') return FS_BINDING_REFUSAL.SCOPE_DRAINING
    if (state.status === 'released') return FS_BINDING_REFUSAL.SCOPE_DISPOSED
    return FS_BINDING_REFUSAL.SCOPE_TERMINATION_UNCONFIRMED
  }

  function assertLive(operation: string): void {
    const refusal = lifecycleRefusal()
    if (refusal === null) return
    // A lifecycle refusal is NOT a lane fact: no admission decision was
    // evaluated, so the fact stream stays a pure record of lane decisions. The
    // refusal's evidence is the thrown name plus the receipt.
    throw new FsError(
      `${label}: ${refusal} — '${operation}' on binding ${JSON.stringify(id)} was refused:`
        + ` the scope is ${state.status} (${state.reason})`
        + (state.disposedAt === null ? '' : ` since ${state.disposedAt}`)
        + '; a non-active binding never falls back to the host provider',
      LANE_REFUSAL_CODE,
    )
  }

  function enterAdmitted(): void {
    state.inFlight += 1
  }

  function leaveAdmitted(): void {
    state.inFlight -= 1
    if (state.inFlight === 0 && state.drainWaiters.length > 0) {
      const waiters = state.drainWaiters.splice(0)
      for (const wake of waiters) wake()
    }
  }

  /**
   * Run one admitted, promise-shaped operation: refuse if not `active`, count it
   * BEFORE the first await, and decrement on EVERY exit (success, throw, or a
   * refusal raised after admission). The counter is what `dispose()` drains.
   */
  async function guarded<T>(method: string, body: () => Promise<T>): Promise<T> {
    assertLive(method)
    enterAdmitted()
    try {
      return await body()
    } finally {
      leaveAdmitted()
    }
  }

  /** Resolve `true` when the counter reaches 0, `false` when the bound expires. */
  function waitForDrain(timeoutMs: number): Promise<boolean> {
    if (state.inFlight === 0) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (value: boolean): void => {
        if (settled) return
        settled = true
        resolve(value)
      }
      // Deliberately NOT unref'd: a drain bound that the event loop may drop is
      // not a bound. The timer lives exactly as long as the disposal that
      // installed it.
      const timer = TIMERS.setTimeout?.(() => finish(false), timeoutMs)
      state.drainWaiters.push(() => {
        TIMERS.clearTimeout?.(timer)
        finish(true)
      })
    })
  }

  function admit(method: string, axis: 'read' | 'write', hostPath: string): void {
    const roots = axis === 'read' ? lane.read : lane.write
    if (withinAny(roots, hostPath)) {
      pushFact(method, axis, hostPath, null)
      return
    }
    refuse(method, axis, hostPath, axis === 'read' ? FS_BINDING_REFUSAL.LANE_READ : FS_BINDING_REFUSAL.LANE_WRITE)
  }

  const ConfinedFileSystem = class extends Base {
    constructor(ctx: unknown, config?: Record<string, unknown>) {
      super(ctx, config)
    }

    /** Every LANE decision this INSTANCE made, in call order (evidence only). */
    get laneFacts(): readonly NativeFsBindingFact[] {
      return facts
    }

    /**
     * Write on an EXISTING target also requires read coverage (`write ⇒ read`).
     * Runs INSIDE the caller's `guarded()` body, so its own `super.stat` await is
     * counted as part of the same admitted operation.
     */
    async admitExistingMutation(method: string, target: unknown, signal?: AbortSignalLike): Promise<void> {
      const hostPath = this.processPath(target)
      admit(method, 'write', hostPath)
      let observed: unknown
      try {
        observed = await super.stat(target, signal)
      } catch {
        // A stat failure is not evidence of absence: fail closed on the read axis.
        refuse(method, 'read', hostPath, FS_BINDING_REFUSAL.WRITE_REQUIRES_READ)
      }
      if (observed !== undefined && !withinAny(lane.read, hostPath)) {
        refuse(method, 'read', hostPath, FS_BINDING_REFUSAL.WRITE_REQUIRES_READ)
      }
    }

    // ── read axis ────────────────────────────────────────────────────────
    override async stat(target: unknown, signal?: AbortSignalLike): Promise<unknown> {
      return guarded('stat', async () => {
        admit('stat', 'read', this.processPath(target))
        return super.stat(target, signal)
      })
    }

    override async lstat(path: string, opts?: unknown, signal?: AbortSignalLike): Promise<unknown> {
      return guarded('lstat', async () => {
        // `lstat` is path-shaped and does not follow the final component: the
        // guarded object is the path itself, so containment is evaluated on the
        // absolute path (a link's own metadata discloses no target content).
        const options = opts as { readonly cwd?: string } | undefined
        const hostPath = path.startsWith('/')
          ? normalizePath(path)
          : normalizePath(joinPath(options?.cwd ?? this.config?.cwd ?? '/', path))
        admit('lstat', 'read', hostPath)
        return super.lstat(path, opts, signal)
      })
    }

    override async readText(target: unknown, signal?: AbortSignalLike): Promise<string> {
      return guarded('readText', async () => {
        admit('readText', 'read', this.processPath(target))
        return super.readText(target, signal)
      })
    }

    override async streamText(target: unknown, signal?: AbortSignalLike): Promise<AsyncIterable<string>> {
      return guarded('streamText', async () => {
        admit('streamText', 'read', this.processPath(target))
        return super.streamText(target, signal)
      })
    }

    override async readBytes(target: unknown, signal: AbortSignalLike | undefined, maxBytes: number): Promise<Uint8Array> {
      return guarded('readBytes', async () => {
        admit('readBytes', 'read', this.processPath(target))
        return super.readBytes(target, signal, maxBytes)
      })
    }

    override async readByteRange(target: unknown, range: unknown, signal?: AbortSignalLike): Promise<Uint8Array> {
      return guarded('readByteRange', async () => {
        admit('readByteRange', 'read', this.processPath(target))
        return super.readByteRange(target, range, signal)
      })
    }

    override async listDir(target: unknown, signal?: AbortSignalLike): Promise<readonly unknown[]> {
      return guarded('listDir', async () => {
        admit('listDir', 'read', this.processPath(target))
        return super.listDir(target, signal)
      })
    }

    override async watch(
      target: unknown,
      changed: (error?: Error) => void,
      signal: AbortSignalLike,
    ): Promise<() => Promise<void>> {
      return guarded('watch', async () => {
        admit('watch', 'read', this.processPath(target))
        // Only REGISTRATION is admitted and drained. The returned disposer owns
        // the live watcher, which is why the receipt never claims the OS stopped.
        return super.watch(target, changed, signal)
      })
    }

    // ── write axis ───────────────────────────────────────────────────────
    override async writeText(
      target: unknown,
      content: string,
      expected?: unknown,
      signal?: AbortSignalLike,
      sandboxPolicy?: unknown,
    ): Promise<unknown> {
      return guarded('writeText', async () => {
        await this.admitExistingMutation('writeText', target, signal)
        return super.writeText(target, content, expected, signal, sandboxPolicy)
      })
    }

    override async editText(
      target: unknown,
      edit: unknown,
      expected?: unknown,
      signal?: AbortSignalLike,
      sandboxPolicy?: unknown,
    ): Promise<unknown> {
      return guarded('editText', async () => {
        await this.admitExistingMutation('editText', target, signal)
        return super.editText(target, edit, expected, signal, sandboxPolicy)
      })
    }

    override async patchText(
      target: unknown,
      hunks: unknown,
      expected?: unknown,
      signal?: AbortSignalLike,
      sandboxPolicy?: unknown,
    ): Promise<unknown> {
      return guarded('patchText', async () => {
        await this.admitExistingMutation('patchText', target, signal)
        return super.patchText(target, hunks, expected, signal, sandboxPolicy)
      })
    }

    override async deleteFile(
      target: unknown,
      expected?: unknown,
      signal?: AbortSignalLike,
      sandboxPolicy?: unknown,
    ): Promise<unknown> {
      return guarded('deleteFile', async () => {
        await this.admitExistingMutation('deleteFile', target, signal)
        return super.deleteFile(target, expected, signal, sandboxPolicy)
      })
    }

    override async moveFile(
      source: unknown,
      destination: unknown,
      options?: unknown,
      signal?: AbortSignalLike,
      sandboxPolicy?: unknown,
    ): Promise<unknown> {
      return guarded('moveFile', async () => {
        await this.admitExistingMutation('moveFile', source, signal)
        admit('moveFile', 'write', this.processPath(destination))
        return super.moveFile(source, destination, options, signal, sandboxPolicy)
      })
    }

    /** Resolution only: admitted and counted, but unguarded by the lane (the check runs on its RESULT). */
    override async resolve(path: string, opts?: unknown): Promise<unknown> {
      return guarded('resolve', async () => super.resolve(path, opts))
    }
  }

  function terminalReceipt(
    terminal: FsBindingTerminalState,
    changed: boolean,
    alreadyDisposed: boolean,
    drained: boolean,
    releaseErrors: readonly string[],
    reason: string,
  ): NativeFsBindingDisposal {
    return Object.freeze({
      bindingId: id,
      state: terminal,
      changed,
      alreadyDisposed,
      drained,
      newOperationsRefused: true,
      releaseConfirmed: terminal === 'released',
      refusalCode: terminal === 'released'
        ? FS_BINDING_REFUSAL.SCOPE_DISPOSED
        : FS_BINDING_REFUSAL.SCOPE_TERMINATION_UNCONFIRMED,
      reason,
      disposedAt: String(state.disposedAt),
      inFlightAtDispose: state.inFlightAtDispose,
      drainTimeoutMs,
      releaseErrors: Object.freeze([...releaseErrors]),
    })
  }

  /**
   * Dispose the scope: `active → draining`, refuse new work, drain admitted work
   * up to `drainTimeoutMs`, then release (when a handler is supplied). Terminal
   * and idempotent: the first call memoises the receipt, later calls return the
   * SAME terminal facts with `changed:false`.
   *
   * A drain timeout does NOT release: killing a provider out from under a parked
   * call is the lifecycle owner's decision, and this binding refuses to pretend
   * it happened. A release step that throws also yields `termination-unconfirmed`
   * — the receipt never claims what did not happen.
   */
  async function dispose(reason?: string, release?: () => Promise<void>): Promise<NativeFsBindingDisposal> {
    if (state.receipt !== null) {
      return Object.freeze({ ...state.receipt, changed: false, alreadyDisposed: true })
    }
    state.status = 'draining'
    state.reason = reason ?? 'disposed'
    state.disposedAt = new Date().toISOString()
    state.inFlightAtDispose = state.inFlight
    const drained = await waitForDrain(drainTimeoutMs)
    const releaseErrors: string[] = []
    let terminal: FsBindingTerminalState
    let why = state.reason
    if (!drained) {
      terminal = 'termination-unconfirmed'
      why = `drain-timeout: ${state.inFlight} admitted operation(s) still unfinished after ${drainTimeoutMs}ms`
    } else if (release === undefined) {
      terminal = 'released'
    } else {
      try {
        await release()
        terminal = 'released'
      } catch (error) {
        terminal = 'termination-unconfirmed'
        const failure = error as { message?: string; errors?: unknown[] }
        if (Array.isArray(failure.errors)) {
          for (const entry of failure.errors) {
            releaseErrors.push(entry instanceof Error ? entry.message : String(entry))
          }
        } else {
          releaseErrors.push(failure.message ?? String(error))
        }
        why = `release-failed: ${releaseErrors.join('; ') || 'unknown release error'}`
      }
    }
    state.status = terminal
    state.reason = why
    const receipt = terminalReceipt(terminal, true, false, drained, releaseErrors, why)
    state.receipt = receipt
    return receipt
  }

  return Object.freeze({
    id,
    generation,
    lane,
    providerClass: ConfinedFileSystem as unknown as NativeFileSystemConstructor,
    get status(): FsBindingStatus {
      return state.status
    },
    get inFlight(): number {
      return state.inFlight
    },
    get facts(): readonly NativeFsBindingFact[] {
      return facts
    },
    assertLive,
    dispose,
  })
}

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
export async function mountNativeFsBinding(input: MountNativeFsBindingInput): Promise<NativeFsBinding> {
  const { ctx, host } = input
  if (ctx === undefined || ctx === null || typeof ctx.isolate !== 'function') {
    throw new NativeFsBindingError(
      'FS_BINDING_HOST_SURFACE_INCOMPLETE',
      'mountNativeFsBinding needs a host Context carrying the public isolate() scope primitive',
    )
  }
  if (host === undefined || host === null || typeof host.generation !== 'string') {
    throw new NativeFsBindingError('FS_BINDING_HOST_SURFACE_INCOMPLETE', 'the host surface must carry a generation stamp')
  }
  if (typeof host.LocalFileSystem !== 'function' || typeof host.FsError !== 'function' || host.toolFs === undefined) {
    throw new NativeFsBindingError(
      'FS_BINDING_HOST_SURFACE_INCOMPLETE',
      'the host surface must carry { LocalFileSystem, FsError, toolFs }',
    )
  }
  // PINNED GENERATION. A different host is refused BY NAME, before any scope or
  // service is created; there is no fallback, no "closest" tree and no retry on
  // another host generation.
  if (host.generation !== input.expectedGeneration) {
    throw new NativeFsBindingError(
      'FS_BINDING_HOST_GENERATION_MISMATCH',
      `the native FS binding was pinned to host generation ${JSON.stringify(input.expectedGeneration)} but the`
        + ` mounted surface answers ${JSON.stringify(host.generation)}; refusing to bind instead of falling back`
        + ' to another host generation',
    )
  }
  const lane = Object.freeze({
    read: normalizeLaneRoots(input.lane.read, input.cwd ?? '/'),
    write: normalizeLaneRoots(input.lane.write, input.cwd ?? '/'),
  })
  const id = input.id ?? `native-fs-binding-${host.generation}`
  const scope = createNativeFsBindingScope({
    id,
    generation: host.generation,
    lane,
    Base: host.LocalFileSystem,
    FsError: host.FsError,
    ...(input.record === undefined ? {} : { record: input.record }),
    ...(input.label === undefined ? {} : { label: input.label }),
    ...(input.drainTimeoutMs === undefined ? {} : { drainTimeoutMs: input.drainTimeoutMs }),
  })

  const fibers: { readonly name: string; readonly fiber: { dispose(): Promise<void> } }[] = []
  let iso: { get(name: string): unknown } | undefined
  try {
    const isolated = ctx.isolate('fs')
    iso = isolated
    const providerFiber = await isolated.plugin(scope.providerClass, { cwd: input.cwd ?? '/' })
    fibers.push({ name: 'provider', fiber: providerFiber })
    const toolFiber = await isolated.plugin(host.toolFs, input.toolConfig ?? {})
    fibers.push({ name: 'tool', fiber: toolFiber })
    const provider = isolated.get('fs')
    if (provider === undefined || provider === null) {
      throw new NativeFsBindingError(
        'FS_BINDING_SERVICE_MISSING',
        'the isolated fs scope mounted no provider service',
      )
    }
    const providerMounted = true
    const toolMounted = true
    /** Release = dispose the fibers this mount created, reporting every failure. */
    const releaseFibers = async (): Promise<void> => {
      const errors: unknown[] = []
      for (const entry of [...fibers].reverse()) {
        try {
          await entry.fiber.dispose()
        } catch (error) {
          errors.push(error)
        }
      }
      if (errors.length > 0) {
        const failure = new Error(
          `release-failed: ${errors.length} of ${fibers.length} fiber disposal(s) threw`,
        ) as Error & { errors: unknown[] }
        failure.errors = errors
        throw failure
      }
    }
    return Object.freeze({
      id: scope.id,
      generation: scope.generation,
      lane: scope.lane,
      providerClass: scope.providerClass,
      provider: provider as NativeFileSystemSurface,
      providerMounted,
      toolMounted,
      get status(): FsBindingStatus {
        return scope.status
      },
      get inFlight(): number {
        return scope.inFlight
      },
      get facts(): readonly NativeFsBindingFact[] {
        return scope.facts
      },
      assertLive: scope.assertLive,
      /**
       * Teardown order is part of the contract: the scope starts DRAINING and
       * refuses new work FIRST, disposal then waits for admitted work, and only
       * a completed drain releases the tool fiber (no new dispatch) and then the
       * provider fiber. If a fiber disposal throws, the receipt says
       * `termination-unconfirmed` and the scope NEVER claims release.
       */
      dispose: async (reason?: string): Promise<NativeFsBindingDisposal> => scope.dispose(
        reason ?? 'binding-disposed',
        releaseFibers,
      ),
    })
  } catch (error) {
    // Rollback path: the ORIGINAL failure is the one reported; the receipt of a
    // failed mount is deliberately not surfaced.
    await scope.dispose('mount-failed', async () => {
      for (const entry of [...fibers].reverse()) {
        try {
          await entry.fiber.dispose()
        } catch {
          // Swallowed here, not by the scope: the mount failure is the report.
        }
      }
    })
    void iso
    throw error
  }
}
