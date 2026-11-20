#!/usr/bin/env node
/**
 * run-new-path.mjs — run the SEARCH corpus on the pinned NEXT host's route-C
 * composition and grade every vector against the SAME golden row B1 captured.
 *
 *   node tests/ute-g1-search/run-new-path.mjs            # run + grade + print
 *   node tests/ute-g1-search/run-new-path.mjs --only SR-G2-no-path-stdin
 *
 * Exit 1 on any failure (undeclared divergence, stale declaration, missing
 * vector, pending marker, provenance escape). A green run prints one
 * `NEW-PATH-VECTOR <id> PASS` line per golden vector plus the declared /
 * observed divergence totals and the executor provenance. Nothing here is a
 * retirement claim: the semantic differences remain declared and unresolved.
 *
 * @module tests/ute-g1-search/run-new-path
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CORPUS } from './lib/corpus.mjs'
import { parseGolden } from './lib/compare.mjs'
import { runCorpus } from './lib/new-path.mjs'
import {
  DECLARED_DIVERGENCES,
  DECLARABLE_DIFFERENCE_IDS,
  checkDeclarations,
  checkModuleProvenance,
  divergenceLine,
  failureLine,
  gradeCorpus,
  provenanceLine,
} from './lib/new-path-compare.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-search', 'golden', 'old-path.tsv')
const argv = process.argv.slice(2)
const onlyIndex = argv.indexOf('--only')
const only = onlyIndex === -1 ? undefined : argv.slice(onlyIndex + 1).filter((arg) => !arg.startsWith('--'))

const tableProblems = checkDeclarations(DECLARED_DIVERGENCES, CORPUS.map((vector) => vector.id), DECLARABLE_DIFFERENCE_IDS)
for (const problem of tableProblems) console.error(`NEW-PATH-DECLARATION-INVALID ${problem}`)

const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const { host, records, witnesses, identity } = await runCorpus({ only })
const graded = gradeCorpus(golden, records, DECLARED_DIVERGENCES)
const provenanceFailures = witnesses.flatMap((witness) => checkModuleProvenance(witness))

for (const verdict of graded.verdicts) {
  if (verdict.pass) console.log(`NEW-PATH-VECTOR ${verdict.id} PASS${verdict.exact ? '' : ' (declared divergence)'}`)
  else for (const failure of verdict.failures) console.error(failureLine({ id: verdict.id, ...failure }))
}
for (const divergence of graded.divergences) console.log(divergenceLine(divergence))
for (const witness of witnesses) console.log(provenanceLine(witness))
for (const failure of provenanceFailures) console.error(`NEW-PATH-FAIL id=${failure.vector} reason=${failure.reason} detail=${JSON.stringify(failure.detail)}`)

console.log(
  `NEW-PATH-DIVERGENCE-TOTAL declared=${graded.declaredCount} observed=${graded.observedCount}`
  + ` ids=${[...new Set(graded.divergences.map((divergence) => divergence.difference))].join(',') || '-'}`,
)
console.log(`NEW-PATH-HOST ${identity}`)
console.log(
  `NEW-PATH-VERDICT ${graded.failures.length === 0 && provenanceFailures.length === 0 && tableProblems.length === 0 ? 'GREEN' : 'RED'}`
  + ` vectors=${graded.verdicts.length} exact=${graded.verdicts.filter((verdict) => verdict.exact).length}`
  + ` divergences=${graded.observedCount} provenance=${provenanceFailures.length === 0 ? 'next-host' : 'DRIFTED'}`
  + ` host=${host.generation}@${host.commit}`,
)

if (tableProblems.length > 0 || graded.failures.length > 0 || provenanceFailures.length > 0) process.exitCode = 1
