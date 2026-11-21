#!/usr/bin/env node
/**
 * capture-old-path.mjs — write / verify the reviewed AGENT-CONTROL old-path
 * golden fixture.
 *
 *   node tests/ute-g1-agentctl/capture-old-path.mjs            # verify (exit 1 on drift)
 *   node tests/ute-g1-agentctl/capture-old-path.mjs --write    # (re)write the golden
 *
 * Verification captures the corpus TWICE and requires the two serializations to
 * be byte-identical; a fixture that only agrees with one run is not a baseline.
 * The exclusion set is PRINTED, always, even when empty — a silent exclusion is
 * how a member disappears from a retirement unit without anyone deciding it.
 *
 * @module tests/ute-g1-agentctl/capture-old-path
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COVERED_MEMBERS, CORPUS } from './lib/corpus.mjs'
import { compareAll, parseGolden, serializeGolden } from './lib/compare.mjs'
import { captureCorpus, oldPathIdentity } from './lib/old-path.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GOLDEN = join(HERE, 'golden', 'old-path.tsv')

/** Declared exclusions: NONE. Every census member has vectors and every witness
 *  is deterministic. This array exists so a future exclusion must be typed. */
const EXCLUSIONS = Object.freeze([])

const write = process.argv.includes('--write')
const records = await captureCorpus()
const second = await captureCorpus()
const firstText = serializeGolden(records)
const secondText = serializeGolden(second)
if (firstText !== secondText) {
  console.error(`OLD-PATH-CAPTURE non-deterministic: two captures differ (${CORPUS.length} vectors)`)
  process.exit(1)
}
console.log(`OLD-PATH-CAPTURE rows=${records.length} members=${COVERED_MEMBERS.length} deterministic=yes`)
console.log(`OLD-PATH-EXCLUSIONS count=${EXCLUSIONS.length}${EXCLUSIONS.length === 0 ? ' — none (all seven members covered; no inherently-variable witness is retained)' : ''}`)
for (const exclusion of EXCLUSIONS) console.log(`OLD-PATH-EXCLUDED member=${exclusion.member} reason=${exclusion.reason}`)
const identity = oldPathIdentity()
console.log(`OLD-PATH-IDENTITY host=${identity.host} composition=${identity.composition}`)

if (write) {
  mkdirSync(dirname(GOLDEN), { recursive: true })
  writeFileSync(GOLDEN, firstText, 'utf8')
  console.log(`OLD-PATH-GOLDEN wrote ${GOLDEN}`)
} else {
  const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
  const verdict = compareAll(golden, records)
  for (const failure of [...verdict.missingObserved, ...verdict.missingGolden]) console.error(`OLD-PATH-MISSING ${failure}`)
  for (const failure of verdict.failures) console.error(`OLD-PATH-DRIFT ${failure.id} ${failure.field}: golden=${JSON.stringify(failure.golden)} observed=${JSON.stringify(failure.observed)}`)
  if (verdict.failures.length > 0 || verdict.missingObserved.length > 0 || verdict.missingGolden.length > 0) {
    console.error(`OLD-PATH-GOLDEN compare=DRIFT rows=${records.length} failures=${verdict.failures.length}`)
    process.exit(1)
  }
  console.log(`OLD-PATH-GOLDEN compare=identical rows=${records.length} members=${COVERED_MEMBERS.length}`)
}
