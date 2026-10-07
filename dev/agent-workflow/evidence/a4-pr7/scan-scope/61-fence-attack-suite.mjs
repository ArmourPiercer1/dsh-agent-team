#!/usr/bin/env node
/**
 * 61-fence-attack-suite.mjs — the round-1..5 attack corpus WITHOUT an
 * admission path (R3 retirement, 2026-10-08; FINDINGS 7-4-cdom §10).
 *
 * This is what survives the class it was built to break. Every case asserts
 * REFUSAL or NOT-RUN — there is no mode, no expectation set, and no mechanism
 * by which any case becomes a pass. The old replay's `vulnerable`/`r45` modes
 * expected admission; that corpus is historical transcript only (evidence
 * 57–59, 63), because a suite that can print `ALL CASES AS EXPECTED` while
 * demonstrating a launderer is the one green that must never exist here.
 *
 * The cases:
 *  CENSUS-DERIVED (the census list, derived live from the fence's own dirty
 *  output and each site's own window tokens — never enumerated): every site
 *  that the retired witness rule ADMITTED (59 measured lower bound; the
 *  reviewer's independent census: 63) must now be NOT-RUN naming the
 *  RETIRED kind. This block runs unconditionally — it is the whole suite,
 *  not a mode.
 *  CORDIS — the shipped composition (cordis.patch.yml::L60) with its own
 *  cheapest witnesses (blueprintSource, bootPhase). The headline of R3: this
 *  row used to leave the dirty set entirely.
 *  B3-COMMENT / RADIUS-DOC — the two constructed misdirections (comment-only
 *  witness; document cluster hidden from a narrow cited range). They used to
 *  pass admission and die at unrelated guards; now the retired kind refuses
 *  them at the first gate, for the honest reason.
 *  RETIRED-KIND-IGNORED — a ledger of ONLY retired rows must not-run (a
 *  retired mechanism that silently tolerated its own rows is one forgetful
 *  rebase from being re-enabled).
 *
 * FLOORS (the reviewer's, adopted): a run that DERIVES ZERO CASES is a broken
 * harness, not a green — exit 3 with its own message (`--filter` matching
 * nothing demonstrates the floor; a floor that cannot fire is decoration).
 * And the census block must see the dirty population: zero dirty sites means
 * the fence changed shape under the suite — also exit 3.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cwd = process.cwd()
const FENCE = 'scripts/verify-blueprint-version-clean.mjs'
const SCRATCH = '.tmp-attack'
const filter = process.argv.includes('--filter') ? process.argv[process.argv.indexOf('--filter') + 1] : ''

rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(SCRATCH, { recursive: true })

const retiredRow = (cite, why) =>
  `intentionally-dirty: ${why} (R3 census artifact — this row MUST not-run); foreign-axis: attack-suite; witness-key: role; owner: attack suite; retirement-check: n/a retired; ${cite}`

// --- derive the population from the fence itself, never from a report -------
let out = ''
try {
  out = execFileSync(process.execPath, [FENCE], { cwd, encoding: 'utf8' })
} catch (e) {
  out = String(e.stdout ?? '')
}
const sites = []
for (const l of out.split('\n')) {
  if (!l.startsWith('OFFENDING ')) continue
  const path = l.split(' :: ')[0].slice('OFFENDING '.length)
  for (const m of l.matchAll(/L(\d+)=v(\d+)/g)) sites.push([path, Number(m[1]), Number(m[2])])
}
if (sites.length === 0) {
  console.error('FLOOR: the fence produced zero dirty sites — the suite is measuring nothing. Not a green: exit 3.')
  process.exit(3)
}

// One row per dirty site, witness = first non-identity token in its own legal
// window — the exact shape that used to admit 59-63 of 87. One spawn per site
// because a single bad row poisons the whole ledger, and THAT is the point.
const cases = []
for (const [path, line, v] of sites) {
  let lines
  try {
    lines = readFileSync(resolve(cwd, path), 'utf8').split('\n')
  } catch {
    continue
  }
  let tok = null
  let wl = line
  outer: for (let d = 1; d <= 11; d += 1) {
    for (const k of [line - 1 - d, line - 1 + d]) {
      if (k < 0 || k >= lines.length) continue
      const L = String(lines[k])
      if (/^\s*(\/\/|\*|\/\*)/.test(L)) continue
      const m = /([A-Za-z_$][A-Za-z0-9_$]*)\s*:/.exec(L)
      if (m !== null && m[1] !== 'schemaVersion') {
        tok = m[1]
        wl = k + 1
        break outer
      }
    }
  }
  if (tok === null) continue
  const from = Math.min(line, wl)
  const to = Math.max(line, wl)
  cases.push({
    id: `census-${path.split('/').pop()}-L${String(line)}-via-${tok}`,
    ledger: { [`${path}::L${String(line)}::v${String(v)}`]: retiredRow(`hand-verified ${path}:${String(from)}-${String(to)}`, `witness that used to admit: ${tok}`) },
  })
}

// the two named R3 exhibits, kept explicit because they are the record
cases.push({
  id: 'cordis-shipped-composition',
  ledger: {
    'cordis.patch.yml::L60::v1': retiredRow('hand-verified cordis.patch.yml:55-65', 'the SHIPPED COMPOSITION: admitted pre-retirement via blueprintSource/bootPhase'),
  },
})
writeFileSync(
  resolve(cwd, SCRATCH, 'b3-comment.ts'),
  [
    '// B3 shape: the only role: in window is a comment (pre-retirement: passed admission)',
    'const doc = [',
    "  '---',",
    `  '${'schema' + 'Version:'} 1',`,
    "].join('\\n')",
    '// role: no blueprint here',
    '',
  ].join('\n'),
)
cases.push({
  id: 'b3-comment-witness',
  ledger: {
    [`${SCRATCH}/b3-comment.ts::L4::v1`]: retiredRow(`hand-verified ${SCRATCH}/b3-comment.ts:1-6`, 'comment-only witness'),
  },
})
writeFileSync(
  resolve(cwd, SCRATCH, 'radius-doc.ts'),
  [
    '// document cluster hidden from the cited range (pre-retirement: passed admission)',
    'const doc = [',
    "  '---',",
    `  '${'schema' + 'Version:'} 1',`,
    "  'blueprintId: ATTK-DOC',",
    "  'revision: 1',",
    "  'contentHash: abc',",
    "  '  role: leader',",
    '].join("\\n")',
    '',
  ].join('\n'),
)
cases.push({
  id: 'radius-doc-cluster',
  ledger: {
    [`${SCRATCH}/radius-doc.ts::L4::v1`]: retiredRow(`hand-verified ${SCRATCH}/radius-doc.ts:1-8`, 'identity-triple cluster site'),
  },
})

// --- FLOOR: a run that derives zero cases (e.g. a filter matching nothing) ---
const active = cases.filter((c) => filter === '' || c.id.startsWith(filter))
if (active.length === 0) {
  console.error(
    `FLOOR: zero cases selected (filter="${filter}" against ${String(cases.length)} derived) — a suite that runs nothing must NOT exit 0. This is the non-emptiness floor proving itself.`,
  )
  process.exit(3)
}

let bad = 0
for (const c of active) {
  const f = resolve(cwd, SCRATCH, `led-${c.id}.json`)
  writeFileSync(f, JSON.stringify(c.ledger))
  let o = ''
  let status = 0
  try {
    o = execFileSync(process.execPath, [FENCE], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DSH_SCAN_ADJUDICATIONS: f, DSH_SCAN_TEST_MODE: '1' },
    })
  } catch (e) {
    o = String(e.stdout ?? '') + String(e.stderr ?? '')
    status = e.status ?? -1
  }
  const ok = status === 2 && /RETIRED/.test(o)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.id.padEnd(52)} exit=${String(status)}${ok ? '' : ` out="${o.split('\n').find((l) => l.includes('not-run')) ?? o.slice(0, 120)}"`}`)
  if (!ok) bad += 1
}
console.log(
  `attack suite: ${String(active.length)} of ${String(cases.length)} cases run, verdict=${bad === 0 ? 'ALL REFUSED (no admission path)' : `${String(bad)} MISMATCHES`}`,
)
rmSync(SCRATCH, { recursive: true, force: true })
process.exit(bad === 0 ? 0 : 1)
