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
 */

/** The labelled rc.5 `workingDirectory` injection double (`a5sf-fs-contract-world.mjs`). */
export declare function provideWorkingDirectoryDouble(ctx: { provide(name: string, value: unknown): void }, defaultDirectory: string): void

/** Dispatch one tool call in the SHAPE the selected host accepts (rc.5 batch / rc.2 single). */
export declare function executeToolDispatch(
  tools: object,
  call: {
    readonly callId: string
    readonly name: string
    readonly arguments: unknown
    readonly signal: AbortSignal
    readonly agent: unknown
  },
  host: {
    readonly hostMode: 'legacy' | 'next'
    readonly onCompletion?: (input: { calls: readonly object[], completion: object }) => void
  },
): Promise<{ readonly isError?: boolean, readonly content: readonly { readonly type?: string, readonly text?: string }[], readonly error?: { readonly message?: string } }>
