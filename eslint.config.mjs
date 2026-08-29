// @ts-check
/**
 * ESLint 9 flat config — minimal rule set for the dsh-agent-team workspace.
 *
 * Lints the workspace source (packages/**, scripts/**, root configs).
 * Toolchain/provenance inputs (dev/**, docs/**) and build output are not
 * linted sources and are ignored.
 */
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.worktrees/**',
      'references/**',
      'dev/**',
      'docs/**',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node scripts (composition smoke, future verify-* scripts) run under
    // node, so node globals are defined there only. TypeScript package code
    // stays global-free: the client half must remain browser-safe.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
)
