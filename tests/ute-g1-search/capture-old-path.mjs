#!/usr/bin/env node
/**
 * capture-old-path.mjs — record the SEARCH family golden vectors on the
 * product route-C composition (0.2.0-rc.2 + the PD-16 search shadow) and
 * write the reviewed fixture.
 *
 *   node tests/ute-g1-search/capture-old-path.mjs            # verify + print
 *   node tests/ute-g1-search/capture-old-path.mjs --write    # (re)write it
 *   node tests/ute-g1-search/capture-old-path.mjs --only SR-G1-inlane-match
 *
 * Exit 1 if any captured record contradicts the corpus's design claim (the
 * corpus-bug path) — a capture is never "whatever the old path did".
 *
 * @module tests/ute-g1-search/capture-old-path
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { CORPUS } from './lib/corpus.mjs'
import { checkDesignClaim, parseGolden, serializeGolden } from './lib/compare.mjs'
import { captureCorpus, OLD_PATH_IDENTITY } from './lib/old-path.mjs'
import { CATEGORY_IDS, REFUSAL_CATEGORIES, UNKNOWN_CATEGORY } from './lib/effect-oracle.mjs'

const REPO_ROOT = process.cwd()
const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-search', 'golden', 'old-path.tsv')
const GOLDEN_REL = relative(REPO_ROOT, GOLDEN)
const argv = process.argv.slice(2)
const onlyIndex = argv.indexOf('--only')
const only = onlyIndex === -1 ? undefined : argv.slice(onlyIndex + 1).filter((arg) => !arg.startsWith('--'))
const write = argv.includes('--write')

/** Refusal classes whose cause is a measured text, not a typed code. */
const TEXTUALLY_CLASSIFIED = new Set(['invalid-argument', 'cancelled'])

const records = await captureCorpus({ only })
let problems = 0
for (const record of records) {
  const vector = CORPUS.find((candidate) => candidate.id === record.id)
  const matchEffect = record.effects.find((effect) => effect.path.startsWith('@matches:'))
  console.log(
    `OLD-PATH-VECTOR ${record.id} entry=${record.entry} composition=route-c`
    + ` outcome=${record.outcome} refusal=${record.refusal ?? 'none'}`
    + ` matches=${matchEffect.exists ? `${matchEffect.bytes} (${matchEffect.mode})` : 'none'}`
    + ` tree=${record.effects.find((effect) => effect.path === '@fs:tree')?.mode}`
    + ` facts=confined:${record.facts.confined}/allow:${record.facts.allowFacts}/deny:${record.facts.denyFacts}/base:${record.facts.baseCalls}`
    + ` codes=${record.codes.join(',') || '-'} leaks=${record.leaks.length === 0 ? 'none' : record.leaks.join(',')}`,
  )
  for (const problem of checkDesignClaim(vector, record)) {
    problems += 1
    console.error(`OLD-PATH-CLAIM-MISMATCH ${record.id} ${problem}`)
  }
  // The closed vocabulary is the ONLY refusal language this fixture may speak.
  if (record.refusal !== null && !CATEGORY_IDS.includes(record.refusal)) {
    problems += 1
    console.error(`OLD-PATH-CATEGORY-OUTSIDE-VOCABULARY ${record.id} refusal=${record.refusal}`)
  }
  if (record.refusal === UNKNOWN_CATEGORY) {
    problems += 1
    console.error(`OLD-PATH-UNCLASSIFIED ${record.id} refusal=unknown; a corpus vector may not rest in the residual bucket`)
  }
  // Two refusal classes have a TEXTUAL cause by construction (the registry's
  // pre-dispatch cancellation and ripgrep's own pattern rejection), so an empty
  // code cell is expected for them and is not a black box.
  if (record.outcome === 'deny' && record.codes.length === 0 && !TEXTUALLY_CLASSIFIED.has(record.refusal)) {
    problems += 1
    console.error(`OLD-PATH-UNCLASSIFIED ${record.id} refusal=${record.refusal} codes=-; name the observed cause in lib/effect-oracle.mjs or record a code`)
  }
}

console.log(
  `OLD-PATH-IDENTITY host=${OLD_PATH_IDENTITY.hostVersion}@${OLD_PATH_IDENTITY.hostCommit}`
  + ` seam="${OLD_PATH_IDENTITY.seam}" dispatch="${OLD_PATH_IDENTITY.dispatch}" vectors=${records.length}`,
)
console.log(`OLD-CATEGORY-VOCABULARY ${CATEGORY_IDS.join(',')}`)
console.log(`OLD-CATEGORY-SIZE ${Object.keys(REFUSAL_CATEGORIES).length}`)

if (write) {
  const text = serializeGolden(records)
  writeFileSync(GOLDEN, text, 'utf8')
  console.log(`OLD-PATH-GOLDEN written=${GOLDEN_REL} bytes=${Buffer.byteLength(text)}`)
} else {
  const previous = readFileSync(GOLDEN, 'utf8')
  const same = previous === serializeGolden(records)
  console.log(`OLD-PATH-GOLDEN compare=${same ? 'identical' : 'DIFFERS'} fixture=${GOLDEN_REL}`)
  if (!same) {
    const previousRows = parseGolden(previous)
    for (const row of previousRows) {
      const next = records.find((record) => record.id === row.id)
      if (next === undefined) continue
      if (serializeGolden([row]).split('\n')[1] !== serializeGolden([next]).split('\n')[1]) {
        console.error(`OLD-PATH-ROW-DRIFT ${row.id}`)
      }
    }
    process.exitCode = 1
  }
}

if (problems > 0) process.exitCode = 1
