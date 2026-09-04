import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const req = createRequire(import.meta.url)
const referencesRoot = fileURLToPath(new URL('../../../../references/deepseek-harness-test-use/', import.meta.url))

/**
 * Build the package-name → src-directory map for every workspace package
 * (packages/<group>/<pkg>) and vendored package (vendor/<pkg>) that exposes
 * a TypeScript source entry. Mirrors the tsconfig paths map the test-use
 * repo generates for its own vitest runs.
 */
function buildSrcMap(): Record<string, string> {
  const map: Record<string, string> = {}
  const roots: Array<[string, string[]]> = [
    ['packages', (() => {
      try { return readdirSync(join(referencesRoot, 'packages')) } catch { return [] }
    })()],
    ['vendor', (() => {
      try { return readdirSync(join(referencesRoot, 'vendor')) } catch { return [] }
    })()],
  ]
  for (const [root, entries] of roots) {
    for (const entry of entries) {
      const entryDir = join(referencesRoot, root, entry)
      let members: string[] = []
      try {
        if (!statSync(entryDir).isDirectory()) continue
        // packages/ is grouped (packages/<group>/<pkg>): entries are the
        // groups, their subdirectories are the packages. vendor/ is flat:
        // entries are the packages themselves.
        if (root === 'packages') {
          members = readdirSync(entryDir).map((pkg) => join(entryDir, pkg))
        } else {
          members = [entryDir]
        }
      } catch { /* unreadable root entry: skip */ }
      for (const pkgDir of members) {
        const pkgJson = join(pkgDir, 'package.json')
        if (!existsSync(pkgJson)) continue
        try {
          const name = JSON.parse(readFileSync(pkgJson, 'utf8')).name
          const src = join(pkgDir, 'src')
          if (name && (existsSync(join(src, 'index.ts')) || existsSync(join(src, 'index.tsx')))) {
            map[name] = src
          }
        } catch { /* malformed manifest: skip */ }
      }
    }
  }
  return map
}

const srcMap = buildSrcMap()

/**
 * use-sync-external-store 1.2.0 ships no `exports` map, and the linked
 * ui-renderer source imports its single consumed entry without an extension
 * ('use-sync-external-store/shim/with-selector'). Strict ESM resolution
 * refuses the extensionless subpath, so the alias below completes it to the
 * real .js file. That file stays EXTERNAL (nothing inlines it), so Node
 * loads it natively — its CJS require chain and cjs-module-lexer
 * named-export detection both resolve it (verified: the namespace exposes
 * useSyncExternalStoreWithSelector).
 */
const uesWithSelector = fileURLToPath(
  new URL(
    '../../../../references/deepseek-harness-test-use/packages/client/ui-renderer/node_modules/use-sync-external-store/shim/with-selector.js',
    import.meta.url,
  ),
)

/**
 * Source redirect for the linked DSH packages (package.json link:
 * devDependencies). Mirrors the upstream resolution facade: the test-use
 * repo's vitest runs vite-tsconfig-paths over tsconfig.base.json, which maps
 * every @deepseek-ai/* to its src/ — "paths must win over package exports so
 * built lib/ never loads a second module-singleton copy". The built
 * lib/client.js of a dynamic client (or api) package is a Cordis module
 * factory registered on window.__ModuleLoader__, which cannot execute
 * outside the browser shell, so every workspace-package entry must resolve
 * to source here. The chain through the linked test-runtime reaches
 * workspace packages that are not direct devDependencies of this package
 * (they resolve through the test-use pnpm layout), so the redirect covers
 * ALL @deepseek-ai/* names via the srcMap scan. When the mapped source
 * target does not exist (notably the packages' own ./src/* export
 * subpaths), the redirect declines and normal resolution (package exports)
 * takes over.
 */
function resolveWorkspaceSource(source: string): string | undefined {
  if (source.includes('?')) return
  const m = source.match(/^(@deepseek-ai\/[\w.-]+)(?:\/(.*))?$/)
  if (!m) return
  const pkg = m[1]
  if (pkg === undefined) return
  const base = srcMap[pkg]
  if (!base) return
  const sub = m[2]
  const target = sub === undefined ? base : join(base, sub)
  for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts'), join(target, 'index.tsx')]) {
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    } catch {
      return
    }
  }
  return
}

/**
 * Runner is kept fully in-process: worker_threads pool (no child_process
 * fork) and preserved symlink paths (no Windows safe-real-path exec probe).
 * Sandboxed Windows environments deny child spawning with piped stdio
 * (EPERM); these settings make the suite pass there and everywhere else.
 *
 * React dedupe: the linked DSH client packages (see package.json link:
 * devDependencies) resolve 'react' from the test-use pnpm store. Alias every
 * react entry to the single copy installed in this package so the linked
 * libraries, @testing-library/react, and the migrated specs share one React
 * instance (same 18.3.1 version as the test-use store).
 */
export default defineConfig({
  plugins: [
    {
      name: 'linked-dsh-source-redirect',
      enforce: 'pre',
      resolveId(source) {
        return resolveWorkspaceSource(source)
      },
    },
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
    server: {
      deps: {
        // Safety net for anything that still resolves through the
        // node_modules symlink paths: the linked DSH packages' TypeScript
        // sources (and vendored cordis) must be transformed by Vite. Node
        // >=22.18 would load externalized .ts sources natively (type
        // stripping), which breaks the extensionless uSES entry import.
        // The negative lookahead keeps the packages' own node_modules
        // dependencies (e.g. use-sync-external-store) EXTERNAL so Node
        // loads those ordinary CJS/ESM modules natively — Vite 8 would
        // evaluate the CJS file as ESM if it were inlined.
        inline: [
          /@deepseek-ai[\\/](?:dsh-client-[\w-]+|cordis)(?![\s\S]*[\\/]node_modules[\\/])/,
          /deepseek-harness-test-use[\\/](?:packages|vendor)(?![\s\S]*[\\/]node_modules[\\/])/,
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
