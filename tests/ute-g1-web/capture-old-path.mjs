#!/usr/bin/env node
/**
 * capture-old-path.mjs — record the WEB family golden vectors on the product
 * route-C composition (0.2.0-rc.2 + the BL-18 confined web face + the PD-27 web
 * shadow over a real loopback fixture) and verify/replace the reviewed fixture.
 *
 *   node tests/ute-g1-web/capture-old-path.mjs            # verify + print
 *   node tests/ute-g1-web/capture-old-path.mjs --write    # (re)write it
 *   node tests/ute-g1-web/capture-old-path.mjs --only WB-F1-inline-text
 *
 * Exit 1 if any captured record contradicts the corpus's design claim (the
 * corpus-bug path) — a capture is never "whatever the old path did".
 *
 * @module tests/ute-g1-web/capture-old-path
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CORPUS } from './lib/corpus.mjs'
import { checkDesignClaim, parseGolden, serializeGolden } from './lib/compare.mjs'
import { captureCorpus, OLD_PATH_IDENTITY } from './lib/old-path.mjs'
import {
  assertVocabularyTotal,
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  TEXTUALLY_CLASSIFIED,
  UNKNOWN_CATEGORY,
} from './lib/effect-oracle.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GOLDEN_REL = 'tests/ute-g1-web/golden/old-path.tsv'
const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-web', 'golden', 'old-path.tsv')
const argv = process.argv.slice(2)
const onlyIndex = argv.indexOf('--only')
const only = onlyIndex === -1 ? undefined : argv.slice(onlyIndex + 1).filter((arg) => !arg.startsWith('--'))
const write = argv.includes('--write')

const records = await captureCorpus({ only })
let problems = 0
const observedCodes = []
for (const record of records) {
  const vector = CORPUS.find((candidate) => candidate.id === record.id)
  const requests = record.effects.find((effect) => effect.path === '@srv:requests')
  const result = record.effects.find((effect) => effect.path === '@result')
  console.log(
    `OLD-PATH-VECTOR ${record.id} entry=${record.entry} composition=route-c`
    + ` outcome=${record.outcome} refusal=${record.refusal ?? 'none'}`
    + ` codes=${record.codes.join(',') || '-'}`
    + ` status=${result?.mode?.replace(/^status=/, '').split(',')[0] ?? '-'}`
    + ` srv=${requests?.bytes ?? '-'}(${requests?.mode?.split(',')[0] ?? '-'})`
    + ` net=loopback:${record.net.loopback}/external:${record.net.external}`
    + ` facts=fetch:${record.facts.fetches}/search:${record.facts.searches}/allow:${record.facts.allowFacts}/deny:${record.facts.denyFacts}/hostweb:${record.facts.hostWeb}`,
  )
  for (const code of record.codes) if (!observedCodes.includes(code)) observedCodes.push(code)
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
  if (record.outcome === 'deny' && record.codes.length === 0 && !TEXTUALLY_CLASSIFIED.includes(record.refusal)) {
    problems += 1
    console.error(`OLD-PATH-UNCLASSIFIED ${record.id} refusal=${record.refusal} codes=-; name the observed cause in lib/effect-oracle.mjs or record a code`)
  }
}

// FAMILY-LEVEL: the mapping must be total for everything this run observed.
const totality = assertVocabularyTotal(observedCodes)
for (const problem of totality.problems) {
  problems += 1
  console.error(`OLD-PATH-VOCABULARY-INCOMPLETE ${problem}`)
}

console.log(
  `OLD-PATH-IDENTITY host=${OLD_PATH_IDENTITY.hostVersion}@${OLD_PATH_IDENTITY.hostCommit}`
  + ` seam="${OLD_PATH_IDENTITY.seam}" dispatch="${OLD_PATH_IDENTITY.dispatch}" vectors=${records.length}`,
)
console.log(`OLD-PATH-TRANSPORT "${OLD_PATH_IDENTITY.transport}" port=${OLD_PATH_IDENTITY.port}`)
console.log(`OLD-CATEGORY-VOCABULARY ${CATEGORY_IDS.join(',')}`)
console.log(`OLD-CATEGORY-SIZE ${Object.keys(REFUSAL_CATEGORIES).length}`)
console.log(`OLD-CATEGORY-OBSERVED ${observedCodes.join(',') || '-'}`)

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
