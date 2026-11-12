#!/usr/bin/env node
/**
 * Two-run field-by-field agreement for the joint acceptance measurement.
 *
 * The two runs are two fresh DSH_HOME worlds, same kit, same ports family. The
 * VERDICTS must agree exactly (same closed vocabulary value for every arm);
 * the measured DETAIL is compared after normalizing the identifiers that
 * necessarily differ between two worlds (run stamp, session/instance/control/
 * goal ids, blueprint hash, home paths, marker hash, observed wait times,
 * exact round counts where the proposition is a threshold).
 *
 * A detail difference is reported, never hidden: `detailAgree: false` names the
 * normalized field that moved. The agreement is over the normalized field, so
 * a genuine semantic difference survives normalization.
 *
 * Usage:
 *   node compare-two-runs.mjs <run1-dir> <run2-dir> [<out.json>]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [d1, d2, outArg] = process.argv.slice(2)
if (d1 === undefined || d2 === undefined) {
  console.error('usage: compare-two-runs.mjs <run1-dir> <run2-dir> [<out.json>]')
  process.exit(2)
}

const NORMALIZATIONS = [
  ['run stamp (2026-11-12T03-36-55)', /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/g, '<stamp>'],
  ['home suffix (the per-world 6-hex id)', /-h\d+-r[0-9a-f]{6}/g, '-h<n>-r<hex>'],
  ['ISO timestamp', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<iso>'],
  ['marker file (stopped-<hash>.json)', /stopped-[0-9a-f]{8,}\.json/g, 'stopped-<hash>.json'],
  ['marker key', /"key":"[0-9a-f]{8,}"/g, '"key":"<hash>"'],
  ['goal id', /goal-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'goal-<id>'],
  ['control id', /ctrl-[0-9a-z]{20,}/g, 'ctrl-<id>'],
  ['instance id', /inst-[0-9a-z]{8,}/g, 'inst-<id>'],
  ['session id', /session-[0-9a-z][0-9a-z-]*/g, 'session-<id>'],
  ['definition fingerprint', /def#\d+/g, 'def#<n>'],
  ['content hash', /sha256:[0-9a-f]{16,}/g, 'sha256:<hash>'],
  ['home path', /\/[^"\s]*tests\/homes\/[^/\s"]+/g, '<home>'],
  ['blueprint dir', /\/[^"\s]*\.c1-smoke-blueprints-[^/\s"]*/g, '<blueprints>'],
  ['fact wait ms', /executionFactWaitMs=\d+/g, 'executionFactWaitMs=<ms>'],
  ['decision wait ms', /decisionWaitMs=\d+/g, 'decisionWaitMs=<ms>'],
  ['round counters (threshold is the clause)', /roundsStarted=\d+->\d+/g, 'roundsStarted=<n>-><n>'],
  ['mock round requests (timing artefact)', /mockRoundRequests=\d+->\d+/g, 'mockRoundRequests=<n>-><n>'],
]

function normalize(text) {
  let s = String(text ?? '')
  for (const [, re, to] of NORMALIZATIONS) s = s.replace(re, to)
  return s
}

function load(dir) {
  const document = JSON.parse(readFileSync(join(dir, 'joint-verdicts.json'), 'utf8'))
  const byArm = new Map(document.arms.map((a) => [a.arm, a]))
  return { document, byArm }
}

const run1 = load(d1)
const run2 = load(d2)
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

const counts = (doc) => doc.counts ?? {}
const verdictTable = {}
for (const row of rows) {
  verdictTable[row.arm] = row.verdict1
}

const result = {
  schema: 'joint-acceptance-agreement/1',
  run1: d1,
  run2: d2,
  verdictsAgree: rows.every((r) => r.verdictAgree),
  detailsAgree: rows.every((r) => r.detailAgree),
  counts: { run1: counts(run1.document), run2: counts(run2.document) },
  recordClass: run1.document.recordClass,
  normalization: NORMALIZATIONS.map(([name, , to]) => `${name} -> ${to}`),
  arms: rows,
}

const out = outArg ?? join(d1, '..', 'joint-v2-prefix-agreement.json')
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)

for (const row of rows) {
  const mark = row.verdictAgree && row.detailAgree ? '=' : row.verdictAgree ? '~' : 'X'
  console.log(`${mark} ${row.arm}  ${row.verdict1} / ${row.verdict2}${row.detailAgree ? '' : '  (detail differs)'}`)
}
console.log(`verdictsAgree=${String(result.verdictsAgree)} detailsAgree=${String(result.detailsAgree)}`)
console.log(`written: ${out}`)
if (!result.verdictsAgree) process.exit(1)
