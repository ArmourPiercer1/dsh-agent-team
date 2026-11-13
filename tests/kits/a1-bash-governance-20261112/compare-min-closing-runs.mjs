#!/usr/bin/env node
/**
 * Two-run field-by-field agreement for ONE min-closing proposition.
 *
 * Adapted from tests/kits/joint-acceptance-20261111/compare-two-runs.mjs. The
 * two runs are two fresh DSH_HOME worlds, same kit/mode, different sanctioned
 * ports. VERDICTS must agree exactly; the measured DETAIL is compared after
 * normalizing the identifiers and counters that necessarily differ between two
 * worlds (run stamp, session/instance/control ids, correlation ids, blueprint
 * hash, home paths, ledger sequences, timing). A remaining difference is
 * reported, never hidden: `detailsAgree:false` prints both normalized strings.
 *
 * Usage:
 *   node compare-min-closing-runs.mjs <run1-dir> <run2-dir> [<out.json>]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [d1, d2, outArg] = process.argv.slice(2)
if (d1 === undefined || d2 === undefined) {
  console.error('usage: compare-min-closing-runs.mjs <run1-dir> <run2-dir> [<out.json>]')
  process.exit(2)
}

const NORMALIZATIONS = [
  ['run stamp (2026-11-13T07-43-33)', /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/g, '<stamp>'],
  ['home suffix (per-world 6-hex id)', /-h\d+-r[0-9a-f]{6}/g, '-h<n>-r<hex>'],
  ['ISO timestamp', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<iso>'],
  ['goal id', /goal-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'goal-<id>'],
  ['control id', /ctrl-[0-9a-z]{20,}/g, 'ctrl-<id>'],
  ['instance id', /inst-[0-9a-z]{8,}/g, 'inst-<id>'],
  ['child session id', /session-team-child-[0-9a-f]{16,}/g, 'session-team-child-<id>'],
  ['root/other session id', /session-(?!team-child)[0-9a-z][0-9a-z-]*/g, 'session-<id>'],
  ['tool call correlation', /call-c1-[0-9a-z]+/g, 'call-c1-<id>'],
  ['request token', /requestToken":"[^"]*"/g, 'requestToken":"<token>"'],
  ['content hash', /sha256:[0-9a-f]{16,}/g, 'sha256:<hash>'],
  ['home path', /\/[^"\s]*tests\/homes\/[^/\s"]+/g, '<home>'],
  ['ledger sequence numbers (ordering is the clause; the absolute number is not)',
    /"(?:request|decision|consumption|executionResult|sequence)":\s*\d+/g,
    (m) => m.replace(/:\s*\d+$/, ':<n>')],
  ['inside/outside Seq JSON', /Seq=\{[^}]*\}/g, 'Seq=<rows>'],
  ['mock correlation in attempts detail', /"correlation":"call-c1-<id>"/g, '"correlation":"<id>"'],
]

function normalize(text) {
  let s = String(text ?? '')
  for (const [, re, to] of NORMALIZATIONS) s = s.replace(re, to)
  return s
}

function load(dir) {
  const document = JSON.parse(readFileSync(join(dir, 'min-closing-verdicts.json'), 'utf8'))
  const byArm = new Map(document.arms.map((a) => [a.arm, a]))
  return { document, byArm }
}

const run1 = load(d1)
const run2 = load(d2)
if (run1.document.mode !== run2.document.mode) {
  console.error(`mode mismatch: ${String(run1.document.mode)} vs ${String(run2.document.mode)}`)
  process.exit(2)
}
const armIds = [...new Set([...run1.byArm.keys(), ...run2.byArm.keys()])].sort()

const rows = armIds.map((arm) => {
  const a = run1.byArm.get(arm)
  const b = run2.byArm.get(arm)
  const verdict1 = a?.verdict ?? 'ABSENT'
  const verdict2 = b?.verdict ?? 'ABSENT'
  const detail1 = normalize(a?.detail ?? '')
  const detail2 = normalize(b?.detail ?? '')
  return {
    arm,
    proposition: a?.proposition ?? b?.proposition ?? '',
    verdict1,
    verdict2,
    verdictAgree: verdict1 === verdict2,
    detailAgree: detail1 === detail2,
    detail1,
    detail2,
  }
})

const result = {
  schema: 'min-closing-agreement/1',
  mode: run1.document.mode,
  recordClass: run1.document.recordClass,
  run1: d1,
  run2: d2,
  verdictsAgree: rows.every((r) => r.verdictAgree),
  detailsAgree: rows.every((r) => r.detailAgree),
  counts: { run1: run1.document.counts ?? {}, run2: run2.document.counts ?? {} },
  compositionAgree: JSON.stringify(run1.document.composition) === JSON.stringify(run2.document.composition),
  normalization: NORMALIZATIONS.map(([name, , to]) => `${name} -> ${typeof to === 'function' ? '<normalized>' : to}`),
  arms: rows,
}

const out = outArg ?? join(d1, '..', `${String(run1.document.mode)}-two-run-agreement.json`)
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)

for (const row of rows) {
  const mark = row.verdictAgree && row.detailAgree ? '=' : row.verdictAgree ? '~' : 'X'
  console.log(`${mark} ${row.arm}  ${row.verdict1} / ${row.verdict2}${row.detailAgree ? '' : '  (detail differs)'}`)
  if (!row.detailAgree) {
    console.log(`  run1: ${row.detail1.slice(0, 700)}`)
    console.log(`  run2: ${row.detail2.slice(0, 700)}`)
  }
}
console.log(`verdictsAgree=${String(result.verdictsAgree)} detailsAgree=${String(result.detailsAgree)} compositionAgree=${String(result.compositionAgree)}`)
console.log(`written: ${out}`)
if (!result.verdictsAgree) process.exit(1)
