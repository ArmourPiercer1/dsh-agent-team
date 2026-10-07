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
const idFilter = process.argv[3] ?? ''
if (mode !== 'vulnerable' && mode !== 'fixed' && mode !== 'r45') {
  console.error('usage: 53-acceptance-replay.mjs vulnerable|r45|fixed [id-prefix]')
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
    admit: mode === 'vulnerable' || mode === 'r45',
    whyRefused: mode === 'fixed' ? /document key|schema/i : null,
  },
  {
    id: 'B-doc-templateid',
    ledger: { ...base, [docKey]: dirtyRow(`hand-verified ${FIX}:26-32`, 'templateId') },
    admit: mode === 'vulnerable' || mode === 'r45',
    whyRefused: mode === 'fixed' ? /document key|schema/i : null,
  },
  {
    id: 'H-doc-persona',
    ledger: { ...base, [docKey]: dirtyRow(`hand-verified ${FIX}:18-28`, 'persona') },
    admit: mode === 'vulnerable' || mode === 'r45',
    whyRefused: mode === 'fixed' ? /document key|schema/i : null,
  },
  {
    // Case P's decisive half: a LEGITIMATE foreign witness with an unbounded
    // range. In-file version (the register's own file) so no tree mutation is
    // needed; the wide range is the laundering vector the reviewer measured.
    id: 'P-wide-range',
    ledger: { ...base, [P7KEY]: dirtyRow(`hand-verified ${P7}:1-578`, 'role') },
    admit: mode === 'vulnerable', // R4.5 already refused the width
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
    admit: mode === 'vulnerable' || mode === 'r45',
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


// ROUND 5 — the second trapdoor (reviewer: laundering cost ONE LEDGER ROW and
// no source edit: `resource` was a permission RULE key absent from the typed
// forbidden list) and the third (B3: the only in-window `role:` was a
// comment). Expectations: `r45` = what 4b7ca211 did (the leak), `fixed` = the
// validator-anchored + comment-masked + radius round.
{
  const fenceMod = null // scratch files for the two constructed cases:
  
// Live derivation: EVERY dirty site whose cited 12-line window contains a
// permission-rule key is a candidate the old fence admitted — discover them
// from the fence's own output rather than enumerating the incident report.
if (mode === 'fixed') {
  let out = ''
  try {
    out = execFileSync(process.execPath, ['scripts/verify-blueprint-version-clean.mjs'], {
      cwd, encoding: 'utf8', env: process.env,
    })
  } catch (e) {
    out = String(e.stdout ?? '')
  }
  const found = []
  for (const l of out.split('\n')) {
    if (!l.startsWith('OFFENDING ')) continue
    const path = l.split(' :: ')[0].slice('OFFENDING '.length)
    for (const m of l.matchAll(/L(\d+)=v(\d+)/g)) found.push([path, Number(m[1]), m[2]])
  }
  const pairs = []
  for (const [path, line, v] of found) {
    let lines
    try {
      lines = readFileSync(resolve(cwd, path), 'utf8').split('\n')
    } catch {
      continue
    }
    for (let k = Math.max(0, line - 12); k < Math.min(lines.length, line + 11); k += 1) {
      if (/(?:^|[^A-Za-z0-9_$])resource\s*:/.test(lines[k]) && !/^\s*(\/\/|\*|\/\*)/.test(lines[k])) {
        pairs.push([path, line, v, k + 1])
        break
      }
    }
  }
  console.log(`derived live resource-window pairs: ${String(pairs.length)}`)
  for (const [path, line, v, wl] of pairs) {
    const key = `${path}::L${String(line)}::v${v}`
    const from = Math.min(line, wl)
    const to = Math.max(line, wl)
    cases.push({
      id: `R5-live-${path.split('/').pop()}-L${String(line)}`,
      ledger: { ...base, [key]: `intentionally-dirty: live pair; foreign-axis: perms; witness-key: resource; owner: replay; retirement-check: n/a; hand-verified ${path}:${String(from)}-${String(to)}` },
      admit: false,
      whyRefused: /document key/i,
    })
  }
}

mkdirSync('.tmp-rr', { recursive: true })
  writeFileSync(
    '.tmp-rr/r5-doc.ts',
    [
      '// constructed: a document the register must refuse',
      'const doc = [',
      "  '---',",
      "  'schemaVersion: 1',",   // line 4 = site
      "  'blueprintId: R5-DOC',",
      '  revision: 1,',
      "  'contentHash: abc',",
      "  '  role: leader',",      // line 8 = foreign witness, string-carried
      "  'members: []',",
      '].join("\n")',
      '',
    ].join('\n'),
  )
  writeFileSync(
    '.tmp-rr/r5-comment.ts',
    [
      '// B3 shape: the only role: in window is a comment',
      'const doc = [',
      "  '---',",
      "  'schemaVersion: 1',",   // line 4 = site
      '].join("\n")',
      '// role: no blueprint here', // line 6 — comment only
      '',
    ].join('\n'),
  )
  const r5dirty = (cite, w) =>
    `intentionally-dirty: r5 replay row; foreign-axis: legacy-team-teammate-md; witness-key: ${w}; owner: replay; retirement-check: n/a replay artifact; ${cite}`
  cases.push({
    id: 'R5-resource-doc',
    ledger: { ...base, 'packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts::L1128::v1': r5dirty(
      'hand-verified packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts:1122-1133', 'resource') },
    admit: mode === 'vulnerable' || mode === 'r45',
    whyRefused: mode === 'fixed' ? /document key/i : null,
  })
  cases.push({
    id: 'R5-radius-doc',
    ledger: { ...base, '.tmp-rr/r5-doc.ts::L4::v1': r5dirty('hand-verified .tmp-rr/r5-doc.ts:1-10', 'role') },
    // exit 2 in every mode, but the REASON is the whole point: r45 passed the
    // witness at admission (refused only by the unrelated foreign-site guard),
    // the fixed fence refuses the DOCUMENT itself.
    admit: false,
    whyRefused: mode === 'fixed' ? /identity-triple cluster/i : /does not classify dirty/,
  })
  cases.push({
    id: 'R5-comment-witness',
    ledger: { ...base, '.tmp-rr/r5-comment.ts::L4::v1': r5dirty('hand-verified .tmp-rr/r5-comment.ts:1-6', 'role') },
    // same reason-differential: r45 read the comment as evidence (refused
    // later, for the wrong reason); the fixed fence masks comments at admission.
    admit: false,
    whyRefused: mode === 'fixed' ? /code\/string only/i : /does not classify dirty/,
  })
  void fenceMod
}

mkdirSync('.tmp-rr', { recursive: true })
let bad = 0
for (const c of cases) {
  if (idFilter !== '' && !c.id.startsWith(idFilter)) continue
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
