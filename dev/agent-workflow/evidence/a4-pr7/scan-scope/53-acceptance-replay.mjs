#!/usr/bin/env node
// Adversarial-review acceptance replay (coordinator dispatch after `70745ef7` DO NOT MERGE).
// Reproduces the reviewer's laundering cases from
// .worktrees/rr-a4dirty/.tmp-rr-scratch/README.md against THIS worktree's fence,
// via the scratch-ledger seam (DSH_SCAN_ADJUDICATIONS + DSH_SCAN_TEST_MODE).
//
//   node 53-acceptance-replay.mjs vulnerable   — the `70745ef7` behaviour (documents ADMITTED)
//   node 53-acceptance-replay.mjs fixed        — the post-fix contract (every case refused)
//
// Exit 0 iff every case behaves as the chosen expectation says. The tree is never
// written; ledgers are scratch files, restored nothing. Proof the register's own
// rows stay honest: case CONTROL must be admitted in BOTH modes.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const mode = process.argv[2]
if (mode !== 'vulnerable' && mode !== 'fixed') {
  console.error('usage: 53-acceptance-replay.mjs vulnerable|fixed')
  process.exit(2)
}
const cwd = process.cwd()
const LEDGER = 'dev/agent-workflow/evidence/a4-pr7/scan-scope/unknown-adjudications.json'
const base = JSON.parse(readFileSync(resolve(cwd, LEDGER), 'utf8'))
const P7 = 'packages/legacy/test/p7t6-teammates-adapter.test.ts'
const FIX = 'packages/domain/blueprint/testdata/fixtures.ts'
const docKey = `${FIX}::L26::v1` // the live v1 emitter, archetype-pinned DIRTY
const P7KEY = `${P7}::L118::v1`
const dirtyRow = (cite, witness) =>
  `intentionally-dirty: adversarial replay row; foreign-axis: legacy-team-teammate-md; witness-key: ${witness ?? 'role'}; owner: fence owner (ledger row) + 7.3 (emitter); retirement-check: run the p7t6 adapter suite and re-read intentional-retired.md row 3; ${cite}`

const cases = [
  {
    id: 'A-doc-members',
    ledger: { ...base, [docKey]: dirtyRow(`hand-verified ${FIX}:26-32`, 'members') },
    admit: mode === 'vulnerable',
    whyRefused: mode === 'fixed' ? /document key|schema/i : null,
  },
  {
    id: 'B-doc-templateid',
    ledger: { ...base, [docKey]: dirtyRow(`hand-verified ${FIX}:26-32`, 'templateId') },
    admit: mode === 'vulnerable',
    whyRefused: mode === 'fixed' ? /document key|schema/i : null,
  },
  {
    id: 'H-doc-persona',
    ledger: { ...base, [docKey]: dirtyRow(`hand-verified ${FIX}:18-28`, 'persona') },
    admit: mode === 'vulnerable',
    whyRefused: mode === 'fixed' ? /document key|schema/i : null,
  },
  {
    // Case P's decisive half: a LEGITIMATE foreign witness with an unbounded
    // range. In-file version (the register's own file) so no tree mutation is
    // needed; the wide range is the laundering vector the reviewer measured.
    id: 'P-wide-range',
    ledger: { ...base, [P7KEY]: dirtyRow(`hand-verified ${P7}:1-578`, 'role') },
    admit: mode === 'vulnerable',
    whyRefused: mode === 'fixed' ? /wider than|width/i : null,
  },
  {
    // Narrow window around a real document, foreign witness NOT in it:
    // refused in both modes — but `fixed` must say WHY (in-range witness absent).
    id: 'O-doc-narrow',
    ledger: { ...base, [docKey]: dirtyRow(`hand-verified ${FIX}:26-32`, 'role') },
    admit: false,
    whyRefused: mode === 'fixed' ? /not present in cited range/i : /hand-verified/,
  },
  {
    // Fix 5: a dirty-class row at a site the fence does NOT classify dirty.
    id: 'N-not-a-dirty-site',
    ledger: { ...base, [`${P7}::L119::v1`]: dirtyRow(`hand-verified ${P7}:118-122`, 'role') },
    admit: mode === 'vulnerable',
    whyRefused: mode === 'fixed' ? /does not classify dirty/i : null,
  },
  {
    // Distinct reasons (fix 5b): ghost line and ghost file must not collapse.
    id: 'L-no-such-line',
    ledger: { ...base, [`${FIX}::L99999::v1`]: dirtyRow(`hand-verified ${FIX}:99999`, 'role') },
    admit: false,
    whyRefused: mode === 'fixed' ? /beyond file end/i : /hand-verified/,
  },
  {
    id: 'G-no-such-file',
    ledger: {
      ...base,
      'packages/nowhere/test/ghost.test.ts::L10::v1': dirtyRow(
        'hand-verified packages/nowhere/test/ghost.test.ts:10',
        'role',
      ),
    },
    admit: false,
    whyRefused: mode === 'fixed' ? /no such file/i : /hand-verified/,
  },
  {
    // CONTROL: the honest p7t6 row (already in the tree ledger, restated) must
    // stay admitted in BOTH modes — the fixes refuse laundering, not the register.
    id: 'CONTROL-honest-p7t6',
    ledger: { ...base },
    admit: true,
    whyRefused: null,
  },
]

mkdirSync('.tmp-rr', { recursive: true })
let bad = 0
for (const c of cases) {
  const f = join('.tmp-rr', `acc-${c.id}.json`)
  writeFileSync(f, JSON.stringify(c.ledger, null, 2))
  let out = ''
  let status = 0
  try {
    out = execFileSync(process.execPath, ['scripts/verify-blueprint-version-clean.mjs'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DSH_SCAN_ADJUDICATIONS: resolve(cwd, f), DSH_SCAN_TEST_MODE: '1' },
    })
  } catch (e) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '')
    status = e.status ?? -1
  }
  const admitted = status !== 2
  const ok = admitted === c.admit && (admitted || c.whyRefused === null || c.whyRefused.test(out))
  const keyLine = out.split('\n').find((l) => l.includes('not-run')) ?? ''
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${c.id.padEnd(22)} exit=${String(status)} admitted=${String(admitted)} ` +
      (admitted ? '' : `reason="${keyLine.slice(0, 150)}"`),
  )
  if (!ok) bad += 1
}
console.log(`mode=${mode} verdict=${bad === 0 ? 'ALL CASES AS EXPECTED' : `${bad} MISMATCHES`}`)
process.exit(bad === 0 ? 0 : 1)
