/**
 * native-ride-double.d.mts — the declaration half of `native-ride-double.mjs`.
 *
 * The double is a plain `.mjs` (a test helper, loaded natively by the two suites that use it and by
 * nobody in the product); the two `.test.ts` suites reach it through this file so `tsc` sees the
 * shape without a repo-wide `allowJs` change — the same `.mjs` + adjacent `.d.mts` pattern as
 * `p8s5a-stub-glue` and `a5-m1-control-legs` in this directory.
 */

/** One executed call, as the double records it. */
export interface NativeRideCall {
  readonly name: string
  readonly callId: string
  readonly arguments: unknown
}

/** The waterfall's answer for one call (`{ kind: 'allow' }` reaches the body). */
export interface NativeRideVerdict {
  readonly kind: 'allow' | 'ask' | 'deny'
  readonly code?: string
  readonly reason?: string
}

export interface NativeRideRun {
  /** Every call that reached a body (0 or 1 per invocation). */
  readonly bodies: readonly NativeRideCall[]
  /** The `tools/pre-execute` waterfall's answer. */
  readonly verdict: NativeRideVerdict
  /** The `tools.guard` reason when the guard stopped the call. */
  readonly refusal?: string
}

export interface NativeRideDouble {
  readonly ctx: {
    get(name: string): unknown
    on(event: string, fn: (...args: never[]) => unknown): () => void
  }
  runCall(input: { callId: string, name: string, args?: Record<string, unknown> }): Promise<NativeRideRun>
  readonly bodies: readonly NativeRideCall[]
}

/** Build the double; `names` are the model-visible tools it claims to register. */
export declare function nativeRideDouble(options?: { names?: readonly string[] }): NativeRideDouble
