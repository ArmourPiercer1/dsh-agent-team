/**
 * run-scanner.mjs — reproducible evidence runner for the p4t6 pin repair.
 *
 * Runs the committed scanner (packages/testkit/fault-injection/
 * session-event-scan.mjs) against the repo root it lives in (the clean
 * candidate worktree) and writes the full deterministic result:
 *   - summary line (repoRoot, filesScanned, summary, exclusions, skips)
 *   - the full sorted scanned file list (one POSIX path per line)
 *
 * Usage (from anywhere):
 *   node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/p4t6-pin/run-scanner.mjs <outDir>
 */

import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
// evidence dir = <repoRoot>/dev/agent-workflow/evidence/<task>/<sub> (5 levels)
const scannerPath = resolve(here, '..', '..', '..', '..', '..', 'packages', 'testkit', 'fault-injection', 'session-event-scan.mjs')
const { scanSessionEventVocabulary } = await import(pathToFileURL(scannerPath).href)

const outDir = process.argv[2]
const result = scanSessionEventVocabulary()

const summary = [
  'repoRoot=' + result.repoRoot,
  'filesScanned=' + result.filesScanned,
  'filesLength=' + result.files.length,
  'packageDirs=' + JSON.stringify(result.packageDirs),
  'summary=' + JSON.stringify(result.summary),
  'excludedSelfFiles=' + JSON.stringify(result.excludedSelfFiles),
  'skippedDirs=' + JSON.stringify(result.skippedDirs),
]
writeFileSync(join(outDir, 'scanner-run-summary.txt'), summary.join('\n') + '\n')
writeFileSync(join(outDir, 'scanner-file-list.txt'), result.files.join('\n') + '\n')
console.log(summary.join('\n'))
