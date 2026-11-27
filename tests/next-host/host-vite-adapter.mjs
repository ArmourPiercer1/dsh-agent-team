/**
 * host-vite-adapter.mjs — the Vite-side RESOLUTION ADAPTER for the one host
 * selector (`tests/next-host/host-select.mjs`).
 *
 * WHY THIS IS NOT A SECOND SELECTION AUTHORITY. Node's ESM resolve hook
 * (`scripts/run-tests-hooks.mjs`) and Vite's resolver are different module
 * systems: Vite resolves a bare specifier to an absolute file itself and never
 * asks the registered Node loader (measured round 116: the Node hook is inert
 * inside the Vite graph). An adapter that re-uses the SAME exported decision
 * function is a second ADAPTER, not a second authority — it holds no pin, no
 * tree, no rc.2/rc.5 path table, and no package-name mapping of its own. Every
 * decision is delegated to `createHostResolver()` and the only thing this file
 * does is turn its answer into the string Vite's `resolveId` returns.
 *
 * TWO MODES, BOTH FROM THE SAME RESOLVER:
 *   - built (default, root `vitest.config.ts`): resolve the package entry
 *     through the selected host's own resolver, contained in the selected
 *     host root; decline when the importer is itself inside that host.
 *   - source (`packages/client/vitest.config.ts`): the same package grammar
 *     and containment, with the built target re-pointed at its sibling
 *     TypeScript source inside the selected pristine tree. This is the
 *     client population's pre-existing need (a built dynamic client entry is a
 *     browser module factory), not a new host choice.
 *
 * FAILURE SEMANTICS ARE THE RESOLVER'S: under `next` a miss throws
 * `HostSelectionError` (never a silent fall-through to the repo's rc.2
 * install); under `legacy` a miss returns undefined so Vite's default
 * resolution (which IS the selected host) answers.
 *
 * @module tests/next-host/host-vite-adapter
 */
import { createHostResolver, testHostMode } from './host-select.mjs'

/**
 * A Vite plugin that resolves bare `@deepseek-ai/*` imports through the one
 * host selector.
 *
 * @param {{repoRoot: string, mode?: 'legacy'|'next', source?: boolean, name?: string}} options
 * @returns {{name: string, enforce: 'pre', resolveId: (spec: string, importer?: string) => string|undefined}}
 */
export function createHostVitePlugin({ repoRoot, mode = testHostMode(), source = false, name } = {}) {
  // Eager: an unknown selector refuses while the config loads (a typed
  // HostSelectionError), never after a first green file has already resolved.
  const resolver = createHostResolver(repoRoot, mode)
  return {
    name: name ?? (source ? 'team-host-source-adapter' : 'team-host-resolution-adapter'),
    enforce: 'pre',
    resolveId(spec, importer) {
      if (source) {
        const result = resolver.resolveSourceForImporter(spec)
        return result === null || result === undefined ? undefined : result.file
      }
      const result = resolver.resolveForImporter(spec, importer)
      if (result !== null && result !== undefined) return result.file
      // ONE MODULE INSTANCE PER PINNED TREE (round 121). The resolver DECLINES
      // a host-internal importer on purpose, and with
      // `resolve.preserveSymlinks: true` Vite's default answer then keeps the
      // per-package `node_modules/@deepseek-ai/<pkg>` SYMLINK path while this
      // adapter names realpaths — the same file became TWO modules (measured on
      // rc.5: two `@deepseek-ai/dsh-scope` copies, so a scoped
      // `systemPrompt.section()` from a host module landed in the GLOBAL layer
      // and collided with a legitimate second managed mount). Answer the SAME
      // realpath a Team importer gets when the specifier resolves inside the
      // importer's OWN pinned tree; every other host-internal import keeps
      // declining so the host's own install still answers for itself.
      const unified = resolver.resolveHostInternalRealpath(spec, importer)
      return unified === null || unified === undefined ? undefined : unified
    },
  }
}
