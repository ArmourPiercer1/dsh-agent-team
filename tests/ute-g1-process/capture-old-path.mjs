#!/usr/bin/env node
/**
 * capture-old-path.mjs — capture (or verify) the OLD-PATH golden fixture.
 *
 *   node tests/ute-g1-process/capture-old-path.mjs            # verify
 *   node tests/ute-g1-process/capture-old-path.mjs --write    # (re)write
 *
 * Two runs of the same corpus must be BYTE-IDENTICAL: the verify mode re-runs
 * the whole corpus and compares the serialized fixture cell by cell, and the
 * test suite spawns this file to prove it. A field that is inherently variable
 * (the child's terminating SIGNAL name, and any wall-clock measurement) is
 * excluded by the PRINTED exclusion set below — never silently.
 *
 * Evidence: dev/agent-workflow/evidence/ute3-process-b1-20261120/old-path-capture.txt
 *
 * @module tests/ute-g1-process/capture-old-path
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CORPUS } from './lib/corpus.mjs'
import { compareAll, parseGolden, serializeGolden } from './lib/compare.mjs'
import { CATEGORY_IDS, REFUSAL_CATEGORIES, auditProcessVocabulary } from './lib/effect-oracle.mjs'
import { OLD_PATH_IDENTITY, captureCorpus, identityLine } from './lib/old-path.mjs'
import { checkClaim } from './lib/scenario.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-process', 'golden', 'old-path.tsv')
const write = process.argv.includes('--write')

/**
 * The PRINTED exclusion set: fields present in the world but deliberately not
 * in the fixture, with the reason. `signal` is only defined when the child was
 * killed (a timeout), and it is the kernel's report, not the caller's decision;
 * it is excluded and the FILESYSTEM witness (the marker the timed-out command
 * never wrote) carries that claim instead.
 */
const EXCLUDED_FIELDS = Object.freeze([
  ['record.signal', 'the terminating signal name of a killed child; excluded, corroborated by the absent marker file'],
  ['record.kind', 'a constant ("confined") on every row; carries no effect'],
  ['timing.*', 'wall-clock: duration/startedAt; excluded because a capture must be byte-identical across runs'],
  ['pid', 'process identity; excluded as machine state'],
  ['workdir (absolute)', 'the fixture root is normalized to <world> in every recorded string'],
])

console.log(identityLine())
console.log(`OLD-PATH-FIXTURE vectors=${String(CORPUS.length)} members=${[...new Set(CORPUS.map((vector) => vector.entry))].join(',')}`)
console.log(`OLD-PATH-EXCLUSIONS ${EXCLUDED_FIELDS.map(([field, reason]) => `${field} (${reason})`).join('; ')}`)
console.log(`OLD-CATEGORY-VOCABULARY ${CATEGORY_IDS.join(',')}`)
console.log(`OLD-CATEGORY-SIZE ${String(Object.keys(REFUSAL_CATEGORIES).length)}`)
const vocabulary = auditProcessVocabulary()
console.log(`OLD-CATEGORY-PROCESS-ENTRIES ${String(vocabulary.length === 0 ? 'clean' : vocabulary.join(' | '))}`)

const records = await captureCorpus()

let problems = 0
for (const record of records) {
  const vector = CORPUS.find((candidate) => candidate.id === record.id)
  const claimProblems = checkClaim(record, vector)
  for (const problem of claimProblems) {
    problems += 1
    console.error(`OLD-PATH-CLAIM ${problem}`)
  }
  const mode = record.effects.find((effect) => effect.path === '@process')
  console.log(`${record.id} entry=${record.entry} outcome=${record.outcome} refusal=${record.refusal ?? '-'} codes=${record.codes} exit=${mode.bytes ?? '-'} timedOut=${String(mode.mode).includes('timedOut=yes') ? 'yes' : 'no'} stdout=${String(record.effects.find((effect) => effect.path === '@stdout').bytes)}B stderr=${String(record.effects.find((effect) => effect.path === '@stderr').bytes)}B leaks=${record.leaks.length === 0 ? 'none' : record.leaks.join(',')}`)
  if (vector.expect.absentFile !== undefined && record.observed.absentFilePresent === true) {
    problems += 1
    console.error(`OLD-PATH-CLAIM ${record.id}: the out-of-lane file ${vector.expect.absentFile} EXISTS`)
  }
}

if (write) {
  const text = serializeGolden(records)
  writeFileSync(GOLDEN, text, 'utf8')
  console.log(`OLD-PATH-GOLDEN written=${GOLDEN} bytes=${String(Buffer.byteLength(text))}`)
} else {
  const previous = readFileSync(GOLDEN, 'utf8')
  const same = previous === serializeGolden(records)
  console.log(`OLD-PATH-GOLDEN compare=${same ? 'identical' : 'DIFFERS'} fixture=${GOLDEN} vectors=${String(records.length)}`)
  if (!same) {
    const compared = compareAll(parseGolden(previous), records)
    for (const failure of compared.failures) {
      console.error(`OLD-PATH-ROW-DRIFT ${failure.id} ${failure.diffs.map((diff) => `${diff.field}: golden=${JSON.stringify(diff.expected)} observed=${JSON.stringify(diff.observed)}`).join(' | ')}`)
    }
    if (compared.missingGolden.length > 0) console.error(`OLD-PATH-DRIFT uncaptured-in-fixture=${compared.missingGolden.join(',')}`)
    if (compared.missingObserved.length > 0) console.error(`OLD-PATH-DRIFT captured-but-missing=${compared.missingObserved.join(',')}`)
    process.exitCode = 1
  }
}

console.log(`OLD-PATH-VERDICT ${problems === 0 ? 'GREEN' : 'RED'} vectors=${String(records.length)} claimProblems=${String(problems)} identity=${OLD_PATH_IDENTITY.route}`)
if (problems > 0) process.exitCode = 1
