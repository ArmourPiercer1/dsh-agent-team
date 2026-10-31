/**
 * A5W web native-reuse PoC — vitest runner config (PoC only, NOT production
 * acceptance criteria). The root vitest.config.ts deliberately does NOT
 * collect `tests/**`; run explicitly:
 *
 *   cd .worktrees/a5w-wspoc
 *   ../../node_modules/.bin/vitest run --config tests/poc-web-native-reuse/vitest.poc.config.ts
 *
 * (the main-repo node_modules is the resolution root — this worktree has no
 * local install; Node/Vite walk up and find it, verified 2026-10-31.)
 */
import { defineConfig } from 'vitest/config'
import { createRequire } from 'node:module'

// The PoC lives under tests/**, which has no upward node_modules face of its
// own; the host runtime packages resolve through the MAIN repo's installed
// tree (this worktree has no local install by design). Resolving via the
// main-repo packages/runtime keeps the same 0.2.0-rc.2 / cordis 4.0.4 pin the
// packages/runtime test suite runs on.
const mainRequire = createRequire(new URL('../../packages/runtime/package.json', import.meta.url))
const alias = Object.fromEntries(
  ['@deepseek-ai/cordis', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-scope', '@deepseek-ai/dsh-system-prompt', '@deepseek-ai/dsh-llm']
    .map((name) => [name, mainRequire.resolve(name)]),
)

export default defineConfig({
  resolve: { alias },
  test: {
    include: ['tests/poc-web-native-reuse/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
