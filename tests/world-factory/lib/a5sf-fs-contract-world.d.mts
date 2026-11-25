/**
 * a5sf-fs-contract-world.d.mts — the declaration half of
 * `a5sf-fs-contract-world.mjs`, limited to the host-shape helpers the
 * COLLECTED vitest suites import.
 *
 * The implementation is plain `.mjs` (the `.mjs` node:test suites import it
 * untyped); a TypeScript suite reaches the same one implementation through this
 * file so `tsc` sees it without a repo-wide `allowJs` change — the same shape
 * as `packages/runtime/src/plugin/vnext/admission-port.d.mts`. Only the exports
 * the TypeScript population uses are declared; adding a new TS consumer means
 * adding its declaration HERE, not copying the helper into another suite.
 *
 * ROUND 123: the `hostMode` parameter is GONE. The World decides the dispatch
 * shape from the LIVE tools service's public capability — exactly the rule the
 * product seam applies — so this declaration carries `worldToolDispatchShape`
 * and the typed refusal instead of a version flag.
 */

/** The labelled rc.5 `workingDirectory` injection double (`a5sf-fs-contract-world.mjs`). */
export declare function provideWorkingDirectoryDouble(ctx: { provide(name: string, value: unknown): void }, defaultDirectory: string): void

/** The typed code a World refusal carries when the service exposes no dispatch contract. */
export declare const WORLD_NO_DISPATCH_CONTRACT: 'A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING'

/**
 * The World's OWN reading of the live service's dispatch contract, by PUBLIC
 * CAPABILITY: `'executor-mount'` when `setExecutor` is a function,
 * `'registry-dispatch'` when `modeFor` is a function or `defaultMode` is
 * present, `undefined` when neither exists.
 */
export declare function worldToolDispatchShape(tools: unknown): 'executor-mount' | 'registry-dispatch' | undefined

/** Thrown by `executeToolDispatch` when the service exposes no dispatch contract; `code` is `WORLD_NO_DISPATCH_CONTRACT`. */
export declare class WorldToolDispatchRefusal extends Error {
  readonly code: string
}

/** Dispatch one tool call in the SHAPE the LIVE service exposes (rc.5 batch / rc.2 single), refusing typed when it exposes neither. */
export declare function executeToolDispatch(
  tools: object,
  call: {
    readonly callId: string
    readonly name: string
    readonly arguments: unknown
    readonly signal: AbortSignal
    readonly agent: unknown
  },
  options?: {
    readonly onCompletion?: (input: { calls: readonly object[], completion: object }) => void
  },
): Promise<{ readonly isError?: boolean, readonly content: readonly { readonly type?: string, readonly text?: string }[], readonly error?: { readonly message?: string } }>
