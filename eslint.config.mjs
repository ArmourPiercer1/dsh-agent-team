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
      // The `.tmp-*/**` pattern above is ROOT-ANCHORED, so it never reached the fixture
      // scratch the suites build under their own packages: `packages/testkit/test/.tmp-fault/`
      // was in the lint universe (measured: a file placed there is linted by `eslint .`, which
      // reports 1103 files with a fixture present and 1102 without). That directory is created
      // and `rmSync`ed by the suite that owns it, so during any root run the scan walks a tree
      // that is being deleted underneath it — measured, 3 of 3 attempts: `eslint` exits 2 with
      // `Error: ENOENT: no such file or directory, open '…/.tmp-fault/repo/scripts/h1.mjs'` at
      // `eslint-helpers.js readAndVerifyFile`, printing no JSON, which reaches §7.6's lint leg
      // as `NOT RUN` (the flake class reported against the root suite). Contention was measured
      // and excluded: four concurrent full scans, and one running against a heavy vitest file,
      // all exited 1 with complete JSON.
      //
      // The exclusion is LOAD-BEARING, and the CLASS is exactly as load-bearing as the one name it
      // replaces. Measured at merged head `bfbd89a5` with five planted `.mjs` files under
      // `packages/testkit/test/.tmp-fault/repo/scripts/` (each containing one unused binding and
      // one undefined call), the whole-repo identity diff run once per config:
      //
      //   a) this line, as shipped         160 lines, 76 distinct, universe 1105, new 0
      //   b) this line DELETED             170 lines, 86 distinct, universe 1110, new 10
      //      (the five planted files then appear on the `universe:` line as gitignored-but-linted,
      //       and each yields two identities: `no-undef` for the call, `no-unused-vars` for the binding)
      //   c) the ONE NAME it replaces      160 lines, 76 distinct, universe 1105, new 0
      //      (the same answer as (a): generalising the pattern cost nothing measurable)
      //   d) this line + a root scratch    161 lines, 77 distinct, universe 1106, new 1
      //      FILE `.tmp-resolve-probe.mjs`  (that file named on the `universe:` line and as
      //       `error no-undef .tmp-resolve-probe.mjs`)
      //
      // The load-bearing part is the delta in (b), not the absolute counts, which move with every
      // file this repository adds: five files that exist only while a test runs entered the lint
      // universe and put ten phantom identities against a baseline nobody edited. Against the 7.5
      // suite's own fixture trees review measured the same mechanism as a phantom `new 60`. The
      // comment that used to sit here claimed "measured 62 identities with the pattern, without it,
      // and with fixtures present" — no run reproduces that, and it is exactly the kind of number
      // that gets a load-bearing exclusion deleted: a stale measurement in a comment is a false
      // claim, not a summary. A leg that goes red because another suite happened to run first is
      // not a lint signal at all.
      //
      // It is not an "ignored files are invisible" reflex, because case (d) is the same measurement
      // in the other direction and the specimen stays visible: these patterns match DIRECTORIES, so
      // a scratch FILE a human leaves at the root — the `.tmp-resolve-probe.mjs` that started this
      // line of work — is linted, named on the `universe:` line, and reddens the diff on purpose.
      // What is removed here is a tree that exists only while a test is running: an identity that
      // appears and disappears with test execution cannot belong to a baseline, and those trees'
      // copies of `scripts/**` are digest-compared to the originals, which ARE linted.
      //
      // And nothing tracked is collateral: no tracked path in this repository has a `.tmp-`
      // component in it (`git ls-files | grep -c '(^|/)\.tmp-'` = 0), and §7.6 asserts that in
      // code now — `no tracked file is invisible to lint except under a prefix this leg names` —
      // instead of leaving it to a grep someone has to remember to run.
      '**/.tmp-*/**',
      // The scratch `scripts/check-artifacts-at-head.mjs` materialises the commit under test
      // into (`<checkout root>/.scratch/artifact-at-head/<pid>-<stamp>`), for the same reason
      // and by the same mechanism as the line above: it is a full checkout with `node_modules`
      // that exists only while one instrument is running. Measured with a nested clone of this
      // repository left in the working tree at `.swt/`: `scripts/lint-identities.mjs --diff`
      // reported `universe: 2782 file(s) linted, 1673 of them gitignored … new 750, resolved 0`
      // where the same command on a clean tree reports `universe: 1109 … new 0, resolved 0`,
      // and 751 output lines named `.swt/`. Ignoring it in `.gitignore` alone cannot help,
      // because ESLint does not read `.gitignore` — which is the sentence at the top of this
      // file's own comment, re-earned the hard way. `**/` rather than root-anchored so a
      // scratch inside a task worktree is covered from whichever root the scan starts at; no
      // tracked path has a `.scratch` component (`git ls-files | grep -c '(^|/)\.scratch'` = 0),
      // and the merge-gate leg that enumerates these prefixes asserts it.
      '**/.scratch/**',
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
