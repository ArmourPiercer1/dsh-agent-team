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
