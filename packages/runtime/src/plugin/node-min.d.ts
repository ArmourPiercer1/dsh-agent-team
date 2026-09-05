/**
 * Minimal Node surface declarations (P8-S5A).
 *
 * The repository has NO `@types/node` dependency (root devDependencies are
 * eslint-only + typescript + vitest, and adding a dependency is outside
 * this task's owned paths). The production entry (host.ts) uses exactly
 * these Node surfaces — `module.register` (the upstream resolution hook),
 * `fs.existsSync` + `url.fileURLToPath` (the location-derived glue/seam
 * defaults, plugin-bundle-form), the `URL` global, and `import.meta.url`.
 * This file declares that surface structurally (stable Node 22/24
 * semantics) so both the typecheck and build programs accept host.ts
 * without any Node type package. Nothing else in the program may rely on
 * this shim.
 */

declare module 'module' {
  /**
   * Register a set of customization hooks (off-thread module resolution).
   * Node builtin `module.register`.
   * @param specifier - the URL of the hooks module.
   * @param parentURL - optional parent used to resolve a relative specifier.
   */
  export function register(specifier: string | URL, parentURL?: string | URL): void
}

declare module 'fs' {
  /**
   * Synchronous existence check. Node builtin `fs.existsSync` (host.ts uses
   * the default-seam candidate probe).
   * @param path - the filesystem path to test.
   * @returns true when the path exists.
   */
  export function existsSync(path: string): boolean
}

declare module 'url' {
  /**
   * Convert a file URL to a platform path. Node builtin `url.fileURLToPath`
   * (host.ts maps the derived seam candidates for the existence probe).
   * @param path - the file URL (or URL object) to convert.
   * @returns the platform-specific path string.
   */
  export function fileURLToPath(path: string | URL): string
}

declare const URL: {
  new (input: string, base?: string | URL): URL
  createURL(input: string, base?: string | URL): URL
}

declare const process: {
  /**
   * The current working directory of the host process. Node builtin
   * `process.cwd` (host.ts defaults the team workspace to the launch
   * directory when the row config carries none — plugin-bundle-form D9).
   */
  cwd(): string
}

declare const console: {
  /**
   * Write a line to the host process's stderr. Node builtin
   * `console.error` (host.ts surfaces every TERMINAL remote-mount
   * outcome and the bootstrap rejection — the observable channel the
   * Cordis logger is not; remote-mount-race fix, root cause C).
   * @param message - the message to write.
   * @param more - additional arguments (stringified by Node).
   */
  error(message: unknown, ...more: unknown[]): void
}

/** A Node timer handle (setInterval/setTimeout return one). */
interface NodeMinTimer {
  /**
   * Unref the timer: never keeps the event loop alive (host.ts unrefs
   * the remote-mount watch timers so unit-test worlds and short-lived
   * hosts exit cleanly; the production host lives on its server handles).
   */
  unref(): NodeMinTimer
}

/** Node builtin `setInterval` (host.ts: the remote-mount connection poll). */
declare function setInterval(callback: () => void, delay: number): NodeMinTimer

/** Node builtin `clearInterval` (host.ts: watcher cleanup on settle/row stop). */
declare function clearInterval(handle: NodeMinTimer): void

/** Node builtin `setTimeout` (host.ts: the remote-mount wait deadline). */
declare function setTimeout(callback: () => void, delay: number): NodeMinTimer

/** Node builtin `clearTimeout` (host.ts: watcher cleanup on settle/row stop). */
declare function clearTimeout(handle: NodeMinTimer): void

declare interface URL {
  /** The serialized URL (the only member host.ts consumes). */
  readonly href: string
  toString(): string
  toJSON(): string
}

declare interface ImportMeta {
  /** The URL of the current module (stable ESM/Node surface). */
  readonly url: string
}
