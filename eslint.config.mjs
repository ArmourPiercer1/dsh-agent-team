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
      '**/composition-shim/**',
      '**/node_modules/**',
      '.worktrees/**',
      'references/**',
      // Gitignored raw-evidence scratch (sanitizer inputs, incl. its .sanitized-tmp
      // working copy). Product lint coverage is unchanged; without this line a
      // local evidence mirror changes `pnpm lint` counts, which made an exact-base
      // comparison report +67 phantom errors in the 0.2.0-rc.2 round.
      // Workspace scratch that lives INSIDE the repo root in this environment:
      // pnpm stores, caches, XDG homes, evidence mirrors and test worlds. ESLint 9
      // does not read .gitignore, so without these entries `eslint .` traverses them
      // -- measured: 13 dot-directories were in lint scope at 11e1609c, and
      // `.pnpm-store/v11/tmp/_tmp_*` files vanish between the directory scan and the
      // read, so `pnpm lint` crashed with ENOENT (exit 2) instead of reporting.
      // `.tmp-*/**` is a pattern so a new scratch directory cannot re-break the gate.
      '.tmp-*/**',
      '.pnpm-store/**',
      '.pnpm-store-testuse/**',
      '.agents/**',
      '.dsh-vision-toolkit/**',
      '.private-raw-evidence/**',
      'dev/**',
      'docs/**',
      'tests/**',
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
    // Plain-Node harness / e2e runner scripts (and the two node-side plugin
    // modules) run under node: node globals are defined for exactly these
    // .mjs files, mirroring the scripts/** block above.
    files: [
      'packages/tools/harness/**/*.mjs',
      'packages/runtime/member-residency/harness/**/*.mjs',
      'packages/runtime/root-binding/harness/**/*.mjs',
      'packages/legacy/session-reader/e2e/**/*.mjs',
      'packages/runtime/test/t12a-live-bridge.mjs',
      'packages/runtime/src/plugin/upstream-resolver.mjs',
      'packages/runtime/src/plugin/live/agent-bindings.mjs',
    ],
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
