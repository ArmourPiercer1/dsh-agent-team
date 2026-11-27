/**
 * tool-executor-mount.d.mts — the declaration half of `tool-executor-mount.mjs`.
 *
 * The implementation is plain `.mjs` (the product glue and the node:test arms
 * import it untyped); the COLLECTED vitest suites that drive the round-121
 * controls reach it through this file so `tsc` sees the exported entry points
 * without a repo-wide `allowJs` change — the same shape as
 * `admission-port.d.mts` and `host-surface-refusal.d.mts` beside it.
 */

/** The dispatch contract of the tools service the seam selected. */
export type HostToolDispatchShape = 'executor-mount' | 'registry-dispatch'

/** What `mountHostToolExecutor` did, and what it named. */
export interface HostToolExecutorRecord {
  /**
   * `undefined` = the tools double declares NEITHER contract: nothing was
   * mounted (and nothing could be), and the first governed call refuses with
   * `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`. Worlds that only use the realm for
   * admission keep working; worlds that dispatch cannot be silently empty.
   */
  readonly shape: HostToolDispatchShape | undefined
  /** TRUE only when THIS call mounted the host executor plugin in the scope. */
  readonly mounted: boolean
  /**
   * The host plugin's own name (`native-tool-executor`), `already-selected`
   * (a deployment/preset mounted one), `registry-dispatch` (rc.2) or
   * `no-dispatch-contract` (neither shape).
   */
  readonly name: string
  readonly plugin?: { readonly name: string, readonly inject?: unknown, readonly apply: unknown }
  readonly dispose?: () => Promise<void>
}

/** What `governedToolExecutorOf` resolved for a call. */
export interface GovernedToolExecutor {
  readonly shape: HostToolDispatchShape
  readonly name: string
  readonly executor: object | undefined
}

export declare const HOST_TOOL_EXECUTOR_SPECIFIER: string
export declare const TOOL_EXECUTOR_CAPABILITY_MISSING: 'A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING'
export declare const TOOL_EXECUTOR_UNAVAILABLE: 'A5SF_TOOL_EXECUTOR_UNAVAILABLE'
export declare const TOOL_EXECUTOR_PLUGIN_INVALID: 'A5SF_TOOL_EXECUTOR_PLUGIN_INVALID'
export declare const TOOL_EXECUTOR_RESULT_MISSING: 'A5SF_TOOL_EXECUTOR_RESULT_MISSING'
export declare const TOOL_DISPATCH_SHAPE_UNSUPPORTED: 'A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED'

/** A typed refusal from the seam (it carries a machine-greppable `code`). */
export declare class A5sfToolExecutorSeamError extends Error {
  readonly code: string
  readonly detail: string
  constructor(code: string, detail: string)
}

export declare function hostToolDispatchShape(tools: object | undefined | null): HostToolDispatchShape | undefined

export declare function selectedToolExecutorOrNull(tools: object, agent: unknown): object | null

export declare function mountHostToolExecutor(input: {
  readonly scope: object
  readonly tools: object | undefined | null
  readonly agent?: unknown
  readonly specifier?: string
}): Promise<HostToolExecutorRecord>

export declare function governedToolExecutorOf(tools: object | undefined | null, agent: unknown): GovernedToolExecutor

/**
 * Refuse a call that is not the SINGLE-CALL shape (typed
 * `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED`), e.g. a batch `{ calls: [...] }`.
 */
export declare function assertSingleCallDispatchShape(call: unknown): void

export declare function dispatchGovernedToolCall(
  tools: object,
  call: {
    readonly callId: string
    readonly name: string
    readonly arguments?: unknown
    readonly agent: unknown
    readonly signal: AbortSignal
  },
): Promise<{ readonly isError?: boolean, readonly content: readonly { readonly type?: string, readonly text?: string }[] }>
