/**
 * p8s5a-artifacts.mjs — file-URL helper for the P8-S5A
 * production-assembly tests.
 *
 * Ruling R22: the `.mjs` owns the `node:` surface; the adjacent
 * `p8s5a-artifacts.d.mts` is its tsc type surface (NodeNext resolves the
 * `./p8s5a-artifacts.mjs` import specifier to the declaration), while the
 * plain-node runner loads the `.mjs` natively.
 *
 * S5A-URL repurpose: the former build-artifact guard
 * (`assertArtifactsBuilt`) + built-entry/seams URL helpers asserted the
 * WRONG contract after the ruling — the sanctioned chain must go green on
 * a FRESH checkout (no `dist/`), and the p8s5a tests now import the entry
 * from TS source (see the test headers). Built-artifact loadability of the
 * dist-mirror entry is proven OUT-OF-CHAIN: the live harness re-run
 * (17/17) and the plain-Node `node --check` + import smoke over the
 * rebuilt dist entry (see dev/agent-workflow/evidence/P8-S/
 * S5A-url-result.md, A6/A7).
 *
 * What remains: the test-owned stub glue bundle file URL (the row-owned
 * `config.glueUrl` channel — the exact production loading path, unchanged
 * by S5A-URL).
 * @module @dsh-agent-team/runtime/test/p8s5a-artifacts
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))

/** @returns {string} the file URL of the test-owned stub glue bundle. */
export function stubGlueUrl() {
  return pathToFileURL(join(testDir, 'p8s5a-stub-glue.mjs')).href
}
