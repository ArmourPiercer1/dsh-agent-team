// measure-oracle-coverage.mjs — R-ORACLE-1 MEASURE leg (offline, no boot, no World).
//
// Runs the SAME `captureOracleBinding` the runners use over EVERY suite module the
// plane currently exposes (u5-canary-runner core-shaped suites + every collected
// suites/<NNN>-*.mjs + the standalone u7-4a-jobs runner) and prints, per suite,
// the exact oracle-coverage gap entries: unresolvedDynamicImports (complete=false
// voiders), unresolvedLiteralReads (literalReadsComplete=false), externalSpecifiers
// (host-bound), unfollowedPaths, excludedHelpers, missingSources. Artifacts go to a
// scratch dir OUTSIDE the repo; only this script + its captured summary are tracked.
//
// Usage: node dev/agent-workflow/evidence/u7r3-oracle1-20261030/measure-oracle-coverage.mjs [scratchDir]
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { captureOracleBinding } from '../../../../tests/world-factory/lib/binding-digests.mjs'
import { loadSuites } from '../../../../tests/world-factory/lib/suites.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const RUNNER_DIR = join(REPO_ROOT, 'tests', 'world-factory')

const scratch = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'u7r3-oracle1-'))

// The runner's own suite names (kept in sync by import below failing loudly if the
// registry shape changes; the names are listed statically so this measure leg never
// imports the boot-capable runner module itself).
const RUNNER_SUITES = ['core', 'core-restart', 'negatives', 'crash-victim', 'u6-shadow']
const collected = await loadSuites({ reserved: RUNNER_SUITES })

/** @type {Array<{suite:string, entry:string}>} */
const targets = [
  ...RUNNER_SUITES.map((suite) => ({ suite, entry: join(RUNNER_DIR, 'u5-canary-runner.mjs') })),
  ...collected.map((s) => ({ suite: s.suite, entry: join(RUNNER_DIR, 'suites', s.file) })),
  { suite: 'u7-4a-jobs', entry: join(RUNNER_DIR, 'u7-4a-jobs-suite.mjs') },
]

const rows = []
for (const { suite, entry } of targets) {
  const evidencePath = join(scratch, `${suite}.oracle.json`)
  const binding = captureOracleBinding({ artifactPath: entry, evidencePath, sourceRoot: RUNNER_DIR, repoRoot: REPO_ROOT, suite })
  const o = binding.worldOracle
  rows.push({
    suite,
    entry: o.entry,
    complete: o.complete,
    literalReadsComplete: o.literalReadsComplete,
    sources: o.sources.length,
    digest: o.digest,
    unresolvedDynamicImports: o.unresolvedDynamicImports,
    unresolvedLiteralReads: o.unresolvedLiteralReads,
    externalSpecifiers: o.externalSpecifiers,
    unfollowedPaths: o.unfollowedPaths,
    excludedHelpers: o.excludedHelpers,
    missingSources: o.missingSources,
  })
}

// core-shaped suites share one artifact; group identical entries for readability.
console.log(JSON.stringify({ schema: 'u7r3-oracle1/measure-20261030', scratch, repoHead: null, rows }, null, 2))
