/**
 * mini-mcp.d.mts — the tsc type surface of `mini-mcp.mjs` (the same
 * `.mjs` + adjacent `.d.mts` pattern as the testkit `session-event-scan`
 * harness and `test/t12a-live-bridge.d.mts`): tsc (NodeNext) resolves these
 * declarations for the `../root-binding/harness/mini-mcp.mjs` import
 * specifier, while the plain-node runner loads the `.mjs` natively.
 *
 * @module @dsh-agent-team/runtime/root-binding/harness/mini-mcp
 */

/** The discovery-shape variants of the mini endpoint (U6, plan §9.3). */
export type MiniMcpToolsVariant = 'single' | 'paginated' | 'none'

/** The options of {@link startMiniMcpServer} (U6 variant selector). */
export interface StartMiniMcpOptions {
  /**
   * The tools/list shape (U6). The default `'single'` is the byte-identical
   * legacy endpoint (one `ping` tool, `pong:<msg>` replies).
   */
  readonly tools?: MiniMcpToolsVariant
}

/** The bound mini server (the port + the underlying node http server). */
export interface MiniMcpServer {
  readonly port: number
  readonly server: import('node:http').Server
}

/**
 * Start the mini streamable-http MCP endpoint on the first free candidate
 * port (see the `.mjs` header for the full contract).
 * @param portCandidates - ports to try, in order.
 * @param options - the U6 discovery-shape variant selector.
 * @returns the bound server.
 */
export function startMiniMcpServer(
  portCandidates: number[],
  options?: StartMiniMcpOptions,
): Promise<MiniMcpServer>

/**
 * Close the mini server (swallows a double close; drops keep-alive sockets).
 * @param mini - the started server.
 * @returns resolves when the server is closed (or immediately when absent).
 */
export function closeMiniServer(
  mini: { readonly port?: number; readonly server?: import('node:http').Server } | null | undefined,
): Promise<void>
