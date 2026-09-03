import { createRequire } from 'node:module'
import { configDefaults, defineConfig } from 'vitest/config'

const req = createRequire(import.meta.url)

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
  resolve: {
    preserveSymlinks: true,
    alias: [
      { find: /^react\/jsx-dev-runtime$/, replacement: req.resolve('react/jsx-dev-runtime') },
      { find: /^react\/jsx-runtime$/, replacement: req.resolve('react/jsx-runtime') },
      { find: /^react-dom\/client$/, replacement: req.resolve('react-dom/client') },
      { find: /^react-dom$/, replacement: req.resolve('react-dom') },
      { find: /^react$/, replacement: req.resolve('react') },
    ],
  },
  test: {
    include: [
      'test/**/*.test.ts',
      'test/**/*.client.spec.ts',
      'test/**/*.client.spec.tsx',
    ],
    exclude: [
      ...configDefaults.exclude,
      // Not part of the T2-runnable suite (plan S7 dispositions):
      // client-bundle + team-plugin are ADAPT (rewritten for the vNext
      // layout in T7); team-marker + team-marker-definition are DROP (Chat
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
