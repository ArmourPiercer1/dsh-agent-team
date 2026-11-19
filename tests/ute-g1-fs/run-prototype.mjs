#!/usr/bin/env node
/**
 * run-prototype.mjs — run the FS-family golden corpus through the G1-FS
 * prototype on the pinned next host, grade it against the old-path fixture, and
 * print one machine-greppable verdict per vector.
 *
 *   node tests/ute-g1-fs/run-prototype.mjs
 *   node tests/ute-g1-fs/run-prototype.mjs --only FS-W4-outside-write
 *
 * Exit 1 on any divergence, any missing fixture, or a missing/drifted next
 * host (the latter throws from `assertNextHostTree` — there is no legacy
 * fallback by construction).
 *
 * @module tests/ute-g1-fs/run-prototype
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { compareAll, fieldValue, parseGolden } from './lib/compare.mjs'
import { loadHostSurface, hostIdentity } from './lib/host.mjs'
import { runCorpus } from './lib/new-path.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-fs', 'golden', 'old-path.tsv')
const argv = process.argv.slice(2)
const onlyIndex = argv.indexOf('--only')
const only = onlyIndex === -1 ? undefined : argv.slice(onlyIndex + 1).filter((arg) => !arg.startsWith('--'))

const host = await loadHostSurface()
console.log(`PROTOTYPE-HOST ${hostIdentity(host.host)}`)
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const { records } = await runCorpus({ only })
const scopedGolden = only === undefined ? golden : golden.filter((record) => only.includes(record.id))
const { verdicts, failures } = compareAll(scopedGolden, records)

for (const verdict of verdicts) {
  if (verdict.ok) {
    const record = records.find((candidate) => candidate.id === verdict.id)
    console.log(
      `NEW-PATH-VECTOR ${verdict.id} PASS outcome=${record.outcome} refusal=${record.refusal ?? 'none'}`
      + ` effects=${fieldValue(record, 'effects')} leaks=${fieldValue(record, 'leaks')}`,
    )
  } else {
    console.log(`NEW-PATH-VECTOR ${verdict.id} FAIL`)
    for (const diff of verdict.diffs) {
      console.log(`NEW-PATH-DIFF ${verdict.id} field=${diff.field} old="${diff.expected}" new="${diff.observed}"`)
    }
  }
}
console.log(`PROTOTYPE-VERDICT ${failures.length === 0 ? 'GREEN' : 'RED'} vectors=${verdicts.length} failed=${failures.length}`)
if (failures.length > 0) process.exitCode = 1
