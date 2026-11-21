#!/usr/bin/env node
/**
 * capture-old-path.mjs — record the FS family golden vectors on the legacy
 * governed path (0.2.0-rc.2 + route-C product seam) and write the reviewed
 * fixture.
 *
 *   node tests/ute-g1-fs/capture-old-path.mjs            # verify + print records
 *   node tests/ute-g1-fs/capture-old-path.mjs --write    # (re)write the fixture
 *   node tests/ute-g1-fs/capture-old-path.mjs --only FS-W1-create
 *
 * Exit 1 if any captured record contradicts the corpus's design claim (the
 * corpus bug path) — a capture is never "whatever the old path did".
 *
 * @module tests/ute-g1-fs/capture-old-path
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { CORPUS } from './lib/corpus.mjs'
import { checkDesignClaim, serializeGolden } from './lib/compare.mjs'
import { captureCorpus, OLD_PATH_IDENTITY } from './lib/old-path.mjs'

const REPO_ROOT = process.cwd()
const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-fs', 'golden', 'old-path.tsv')
const GOLDEN_REL = relative(REPO_ROOT, GOLDEN)
const argv = process.argv.slice(2)
const onlyIndex = argv.indexOf('--only')
const only = onlyIndex === -1 ? undefined : argv.slice(onlyIndex + 1).filter((arg) => !arg.startsWith('--'))
const write = argv.includes('--write')

const records = await captureCorpus({ only })
let problems = 0
for (const record of records) {
  const vector = CORPUS.find((candidate) => candidate.id === record.id)
  console.log(
    `OLD-PATH-VECTOR ${record.id} entry=${record.entry} composition=${vector.composition ?? 'route-c'}`
    + ` outcome=${record.outcome} refusal=${record.refusal ?? 'none'}`
    + ` effects=${record.effects.map((effect) => `${effect.path}:${effect.exists ? `${effect.bytes}B/${effect.mode}` : 'absent'}`).join(',') || '-'}`
    + ` codes=${record.codes.join(',') || '-'} leaks=${record.leaks.length === 0 ? 'none' : record.leaks.join(',')}`,
  )
  for (const problem of checkDesignClaim(vector, record)) {
    problems += 1
    console.error(`OLD-PATH-CLAIM-MISMATCH ${record.id} ${problem}`)
  }
  // `other` is the honest terminal bucket, never a silent one. A corpus vector
  // must name its cause (see lib/lane.mjs); if a future vector genuinely needs
  // `other`, its row must at least carry an observed code, never `-`.
  if (record.refusal === 'other' && record.codes.length === 0) {
    problems += 1
    console.error(`OLD-PATH-UNCLASSIFIED ${record.id} refusal=other codes=-; name the observed cause in lib/effect-oracle.mjs or record a code`)
  }
}

console.log(
  `OLD-PATH-IDENTITY host=${OLD_PATH_IDENTITY.hostVersion}@${OLD_PATH_IDENTITY.hostCommit}`
  + ` seam="${OLD_PATH_IDENTITY.seam}" dispatch="${OLD_PATH_IDENTITY.dispatch}" vectors=${records.length}`,
)

if (write) {
  const text = serializeGolden(records)
  writeFileSync(GOLDEN, text, 'utf8')
  console.log(`OLD-PATH-GOLDEN written=${GOLDEN_REL} bytes=${Buffer.byteLength(text)}`)
} else {
  const previous = readFileSync(GOLDEN, 'utf8')
  const same = previous === serializeGolden(records)
  console.log(`OLD-PATH-GOLDEN compare=${same ? 'identical' : 'DIFFERS'} fixture=${GOLDEN_REL}`)
  if (!same) process.exitCode = 1
}

if (problems > 0) process.exitCode = 1
