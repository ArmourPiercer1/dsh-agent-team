/**
 * Minimal Node surface declarations (P8-S5A).
 *
 * The repository has NO `@types/node` dependency (root devDependencies are
 * eslint-only + typescript + vitest, and adding a dependency is outside
 * this task's owned paths). The production entry (host.ts) uses exactly
 * three Node surfaces — `module.register` (the upstream resolution hook),
 * the `URL` global, and `import.meta.url`. This file declares that surface
 * structurally (stable Node 22/24 semantics) so both the typecheck and
 * build programs accept host.ts without any Node type package. Nothing
 * else in the program may rely on this shim.
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

declare var URL: {
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
