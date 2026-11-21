#!/usr/bin/env node
/**
 * partition.mjs — derive the five-group split of the 31 blocking differences
 * from the ledger, with every id assigned exactly once.
 *
 * The earlier release request enumerated 7 in Group A but called it 8,
 * double-counted three refusal-surface ids in A and E, and collapsed the eight
 * UI/AS shape differences into four in D. This script makes the partition
 * mechanical: an id that is not in exactly one group fails the run, and the
 * printed counts must be A=7, B=5, C=4, D=14, E=1.
 *
 * Usage: node dev/agent-workflow/evidence/ute3-review-20261121/partition.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const LEDGER = join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'ute-retirement.json')

/** The five groups, keyed by `<family>:<difference id>`. */
const GROUPS = Object.freeze({
  A: [
    'fs:lane-refusal-code',
    'fs:refusal-observation-shape',
    'search:SD-SEARCH-3-refusal-surface',
    'web:SD-WEB-3-refusal-surface',
    'process:SD-PROCESS-4-refusal-surface',
    'ui:SD-UI-refusal-vocabulary',
    'agent-state:SD-AS-refusal-vocabulary',
  ],
  B: [
    'web:SD-WEB-1-native-name-claim-collision',
    'agent-control:SD-AGENTCTL-2-native-name-claim-not-graded',
    'inspect:alias-to-native-name-change',
    'ui:SD-UI-two-implementations',
    'agent-state:SD-AS-two-implementations',
  ],
  C: [
    'agent-control:SD-AGENTCTL-1-route-c-unserved',
    'ui:SD-UI-product-route-absent',
    'agent-state:SD-AS-product-route-absent',
    'process:SD-PROCESS-3-pty-face-not-measured',
  ],
  D: [
    'search:SD-SEARCH-1-grep-path-default',
    'search:SD-SEARCH-2-grep-vcs-ignore',
    'web:SD-WEB-2-redirect-ownership',
    'process:SD-PROCESS-1-no-truncation-flag',
    'process:SD-PROCESS-2-killed-exit-status',
    'process:SD-PROCESS-5-pwsh-member-unreachable',
    'ui:SD-UI-result-envelope',
    'ui:SD-UI-state-sink',
    'ui:SD-UI-present-receipt-turn',
    'ui:SD-UI-timed-pending-shape',
    'agent-state:SD-AS-result-envelope',
    'agent-state:SD-AS-state-sink',
    'agent-state:SD-AS-present-receipt-turn',
    'agent-state:SD-AS-timed-pending-shape',
  ],
  E: ['agent-control:SD-AGENTCTL-3-governed-admission-surface'],
})

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'))
const ledgerIds = []
for (const row of ledger.families) {
  for (const difference of row.terms.semanticDifferencesResolved.differences ?? []) {
    ledgerIds.push(`${row.family}:${difference.id}`)
  }
}

const assigned = []
const problems = []
for (const [group, ids] of Object.entries(GROUPS)) {
  assertUnique(group, ids)
  assigned.push(...ids)
}
assertUnique('ALL', assigned)

assertUnique('LEDGER', ledgerIds)
const missing = ledgerIds.filter((id) => !assigned.includes(id))
const extra = assigned.filter((id) => !ledgerIds.includes(id))
if (missing.length > 0) problems.push(`unassigned ledger ids: ${missing.join(', ')}`)
if (extra.length > 0) problems.push(`assigned ids not in the ledger: ${extra.join(', ')}`)

const EXPECTED = { A: 7, B: 5, C: 4, D: 14, E: 1 }
for (const [group, expected] of Object.entries(EXPECTED)) {
  if (GROUPS[group].length !== expected) problems.push(`group ${group}: ${GROUPS[group].length} ids, expected ${expected}`)
}
if (assigned.length !== 31) problems.push(`total ${assigned.length}, expected 31`)
if (ledgerIds.length !== 31) problems.push(`ledger has ${ledgerIds.length} ids, expected 31`)

if (problems.length > 0) {
  console.error(`PARTITION RED ${problems.join(' | ')}`)
  process.exitCode = 1
} else {
  for (const [group, ids] of Object.entries(GROUPS)) {
    console.log(`PARTITION group=${group} count=${ids.length} ids=${ids.join(',')}`)
  }
  console.log(`PARTITION VERDICT GREEN groups=5 total=${assigned.length} unique=${assigned.length} ledger=${ledgerIds.length} counts=A7,B5,C4,D14,E1`)
}

function assertUnique(label, ids) {
  const seen = new Set()
  for (const id of ids) {
    if (seen.has(id)) problems.push(`${label}: id appears twice: ${id}`)
    seen.add(id)
  }
}
