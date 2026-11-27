import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import { createHostVitePlugin } from '../../tests/next-host/host-vite-adapter.mjs'
import { selectedHostTree } from '../../tests/next-host/host-select.mjs'

const req = createRequire(import.meta.url)

/** This package's root; the Team checkout is two levels up. */
const PACKAGE_ROOT = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

/**
 * THE SELECTED HOST TREE (rc.2 by default, rc.5 under `TEAM_TEST_HOST=next`).
 * The old config discovered `tests/deepseek-harness-test-use` by walking up
 * from this file and scanned it into a package→src map; that was an rc.2-only
 * resolution rule living outside the one selector. The tree now comes from
 * `tests/next-host/host-select.mjs`, and the redirect comes from the shared
 * Vite adapter (`tests/next-host/host-vite-adapter.mjs`), which holds no pin,
 * no tree and no package table of its own.
 *
 * Why SOURCE and not the built `lib/`: the built entry of a dynamic client
 * package is a Cordis module factory registered on the browser shell's
 * `window.__ModuleLoader__`, so it cannot execute outside the browser. The
 * adapter re-points the built target the host's OWN `exports` map chose at its
 * sibling TypeScript source inside the SAME selected tree (never a
 * hand-written path table), so `TEAM_TEST_HOST=legacy` reproduces the previous
 * rc.2 source redirect byte-for-byte and `next` gets the rc.5 source graph.
 */
const hostTree = selectedHostTree(REPO_ROOT)

/**
 * use-sync-external-store 1.2.0 ships no `exports` map, and the host's
 * ui-renderer source imports its single consumed entry without an extension
 * ('use-sync-external-store/shim/with-selector'). Strict ESM resolution refuses
 * the extensionless subpath, so the alias below completes it to the real .js
 * file. The file stays EXTERNAL (nothing inlines it), so Node loads it
 * natively — its CJS require chain and cjs-module-lexer named-export detection
 * both resolve it. Read from the SELECTED tree, so the alias cannot silently
 * point the rc.5 run at the rc.2 copy.
 */
const uesWithSelector = join(
  hostTree,
  'packages/client/ui-renderer/node_modules/use-sync-external-store/shim/with-selector.js',
)

/** Escape a literal path for use inside a RegExp. */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

/**
 * Runner is kept fully in-process: worker_threads pool (no child_process
 * fork) and preserved symlink paths (no Windows safe-real-path exec probe).
 * Sandboxed Windows environments deny child spawning with piped stdio
 * (EPERM); these settings make the suite pass there and everywhere else.
 *
 * React dedupe: the linked DSH client packages resolve 'react' from the
 * test-use pnpm store. Alias every react entry to the single copy installed in
 * this package so the linked libraries, @testing-library/react, and the
 * migrated specs share one React instance (same version as the host store).
 */
export default defineConfig({
  plugins: [
    // The shared host adapter: same resolver the Node ESM hook calls, in its
    // source-preference mode (see the module docstring above).
    createHostVitePlugin({ repoRoot: REPO_ROOT, source: true }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: [
      { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') },
      { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') },
      { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') },
      { find: /^react-dom$/, replacement: req.resolve('react-dom') },
      { find: /^react$/, replacement: req.resolve('react') },
      { find: /^use-sync-external-store\/shim\/with-selector$/, replacement: uesWithSelector },
    ],
  },
  test: {
    // 0.1.7: jsdom lacks ResizeObserver (the upstream Tooltip primitive now
    // uses it) — see test/setup-jsdom.ts. The second entry is the per-worker
    // false-green guard: it imports a bare host package through this same
    // adapter and REFUSES a run whose loaded host version differs from the pin.
    setupFiles: [join(PACKAGE_ROOT, 'test/setup-jsdom.ts'), join(REPO_ROOT, 'tests/next-host/host-version-guard.mjs')],
    server: {
      deps: {
        // Safety net for anything that still resolves through the
        // node_modules symlink paths: the selected host's TypeScript sources
        // (and vendored cordis) must be transformed by Vite. Node >=22.18
        // would load externalized .ts sources natively (type stripping), which
        // breaks the extensionless uSES entry import. The negative lookahead
        // keeps the host's own node_modules dependencies
        // (e.g. use-sync-external-store) EXTERNAL so Node loads those ordinary
        // CJS/ESM modules natively — Vite 8 would evaluate the CJS file as ESM
        // if it were inlined. The tree half of the pattern is DERIVED from the
        // selector, not a second hard-coded tree name.
        inline: [
          /@deepseek-ai[\\/](?:dsh-client-[\w-]+|cordis)(?![\s\S]*[\\/]node_modules[\\/])/,
          new RegExp(`${escapeRegExp(hostTree)}[\\\\/](?:packages|vendor)(?![\\s\\S]*[\\\\/]node_modules[\\\\/])`),
        ],
      },
    },
    include: [
      'test/**/*.test.ts',
      'test/**/*.client.spec.ts',
      'test/**/*.client.spec.tsx',
    ],
    exclude: [
      ...configDefaults.exclude,
      // Not part of the T2-runnable suite (the client bundle is rebuilt and
      // validated in T7); team-marker + team-marker-definition are DROP (Chat
      // marker vocabulary; retired with evidence in T10).
      'test/client-bundle.client.spec.ts',
      'test/team-plugin.client.spec.tsx',
      'test/team-marker.client.spec.tsx',
      'test/team-marker-definition.client.spec.ts',
    ],
    environment: 'node',
    pool: 'threads',
  },
})
