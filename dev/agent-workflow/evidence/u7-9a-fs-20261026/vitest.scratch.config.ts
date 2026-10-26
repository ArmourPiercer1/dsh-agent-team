// U7-9a golden recorder throwaway config — authoring only (kept with the
// scratch recorder for provenance; the root vitest.config.ts EXCLUDES
// *.scratch.test.ts so CI never collects it).
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ['/srv/workspace/dsh-plugins/dsh-agent-team'] } },
  test: {
    include: ['packages/runtime/test/*.scratch.test.ts'],
    environment: 'node',
    pool: 'threads',
  },
})
