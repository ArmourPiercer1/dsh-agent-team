/**
 * p8s5a-artifacts.mjs — build-artifact guard + file-URL helpers for the
 * P8-S5A production-assembly / host-loadability tests.
 *
 * Ruling R22: the `.mjs` owns the `node:` surface; the adjacent
 * `p8s5a-artifacts.d.mts` is its tsc type surface (NodeNext resolves the
 * `./p8s5a-artifacts.mjs` import specifier to the declaration), while the
 * plain-node runner loads the `.mjs` natively.
 *
 * The guard asserts the S5-PRE load-path artifacts exist before any test
 * imports the built entry:
 *
 *   1. `packages/runtime/dist/packages/runtime/src/plugin/host.js` — the
 *      built production entry (the row artifact);
 *   2. `packages/runtime/dist/packages/legacy/session-reader/index.js` —
 *      the separately noCheck-built frozen legacy reader (mirror-emitted
 *      into the runtime dist);
 *   3. `packages/runtime/node_modules/yaml` — the dist mirror's one bare
 *      third-party import, linked by the build step (see
 *      run.mjs buildProductionRuntime step 3).
 *
 * NO build is performed here: the runner chain is spawn-free by design
 * (scripts/run-tests.mjs header), so the sanctioned build is a parent-level
 * step (`node node_modules/typescript/bin/tsc -p packages/legacy/
 * tsconfig.build.json` then `-p packages/runtime/tsconfig.build.json` from
 * the worktree root) and the guard fails with the exact recipe when the
 * artifacts are absent.
 * @module @dsh-agent-team/runtime/test/p8s5a-artifacts
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(testDir, '..')

const REQUIRED_ARTIFACTS = [
  join(packageRoot, 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
  join(packageRoot, 'dist', 'packages', 'legacy', 'session-reader', 'index.js'),
  join(packageRoot, 'node_modules', 'yaml', 'package.json'),
]

/**
 * Fail loudly (with the sanctioned build recipe) when a required artifact
 * is missing.
 * @returns {void}
 */
export function assertArtifactsBuilt() {
  const missing = REQUIRED_ARTIFACTS.filter((p) => !existsSync(p))
  if (missing.length > 0) {
    throw new Error(
      'P8-S5A production artifacts missing — from the worktree root run: ' +
        'node node_modules/typescript/bin/tsc -p packages/legacy/tsconfig.build.json; ' +
        'node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.build.json; ' +
        'then link packages/runtime/node_modules/yaml -> packages/domain/node_modules/yaml ' +
        '(packages/tools/harness/run.mjs buildProductionRuntime performs all three steps). ' +
        `Missing: ${missing.join(', ')}`,
    )
  }
}

/** @returns {string} the file URL of the built production entry. */
export function builtHostUrl() {
  return pathToFileURL(
    join(packageRoot, 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
  ).href
}

/** @returns {string} the file URL of the test-owned stub glue bundle. */
export function stubGlueUrl() {
  return pathToFileURL(join(testDir, 'p8s5a-stub-glue.mjs')).href
}

/** @returns {string} the file URL of the built seams module (proxy probe). */
export function builtSeamsUrl() {
  return pathToFileURL(
    join(packageRoot, 'dist', 'packages', 'runtime', 'src', 'plugin', 'seams.js'),
  ).href
}
