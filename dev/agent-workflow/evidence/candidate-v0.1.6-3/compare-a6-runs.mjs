#!/usr/bin/env node
/**
 * compare-a6-runs.mjs — two-run field-by-field agreement for the shipped A6
 * approval-plane instrument (`tests/kits/c1-leader-approval-smoke/`).
 *
 * The joint comparator (`tests/kits/joint-acceptance-20261111/compare-two-runs.mjs`)
 * compares the eleven J arms. This script is written for the C2-A adjudication
 * because the joint driver short-circuits its legacy A6 section under `JOINT`
 * (see the C2-A README, "deviation 3"), so the A6 checks are driven by the
 * underlying C1 kit and need their own agreement read.
 *
 * Input: two evidence directories, each containing the kit's `run.log`.
 * Output: a JSON file. VERDICTS must agree exactly for every check id; the
 * measured DETAIL is compared after normalizing only per-world identifiers
 * (documented in `normalization` in the output). A detail difference is
 * reported, never hidden.
 *
 * Usage: node compare-a6-runs.mjs <run1-dir> <run2-dir> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [d1, d2, out] = process.argv.slice(2)
if (!d1 || !d2 || !out) {
  console.error('usage: compare-a6-runs.mjs <run1-dir> <run2-dir> <out.json>')
  process.exit(2)
}

// The same class of per-world values the shipped joint comparator normalizes,
// plus the ones this kit's detail lines carry (sequence numbers, requestToken
// strings, mocked tool call ids).
const NORMALIZATIONS = [
  ['ISO timestamp', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<iso>'],
  ['run stamp (2026-11-12T18-04-25)', /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/g, '<stamp>'],
  ['defaultWorkspace path (may be log-truncated)', /"defaultWorkspace":"[^"]*"?/g, '"defaultWorkspace":"<path>"'],
  ['home/workspace path', /\/[^"\s]*tests\/homes\/[^/\s"]+/g, '<home>'],
  ['blueprint scratch dir', /\/[^"\s]*\.c1-smoke-blueprints-[^/\s"]*/g, '<blueprints>'],
  ['rpc id (per-RPC random)', /"rpcId":"[^"]*"/g, '"rpcId":"<id>"'],
  ['control id', /ctrl-[0-9a-z]{20,}/g, 'ctrl-<id>'],
  ['case id', /case-[0-9a-z]{20,}/g, 'case-<id>'],
  ['instance id', /inst-[0-9a-z]{8,}/g, 'inst-<id>'],
  ['session id', /session-[0-9a-z][0-9a-z-]*/g, 'session-<id>'],
  ['sha256', /sha256:[0-9a-f]{16,}/g, 'sha256:<hash>'],
  ['native bash hexec call id', /:hexec:[0-9a-z-]+/g, ':hexec:<id>'],
  ['mock tool call id', /call-c1-[0-9a-z]+/g, 'call-c1-<id>'],
  ['requestToken', /[a-z0-9-]+-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9-]+/g, '<token>'],
  ['ledger sequence numbers', /(sequence|seq)[=:]\s*\d+/g, '$1=<n>'],
  ['absolute worktree path', /\/[^"\s]*\.worktrees\/c2a-cand3/g, '<worktree>'],
]

function normalize(text) {
  let s = String(text ?? '')
  for (const [, re, to] of NORMALIZATIONS) s = s.replace(re, to)
  return s.trim()
}

function load(dir) {
  const text = readFileSync(join(dir, 'run.log'), 'utf8')
  const byId = new Map()
  for (const line of text.split('\n')) {
    // "[ts] PASS A6-2: proposition — detail"
    const m = /^\[[^\]]+\]\s+(PASS|FAIL|NOT_REACHED|NOT_SELECTED|UNSUPPORTED|ENV_BLOCK)\s+([A-Za-z0-9.-]+):\s*(.*)$/.exec(line)
    if (!m) continue
    const [, verdict, id, rest] = m
    byId.set(id, { verdict, rest })
  }
  return byId
}

const a = load(d1)
const b = load(d2)
const ids = [...new Set([...a.keys(), ...b.keys()])].sort()

const rows = ids.map((id) => {
  const ra = a.get(id)
  const rb = b.get(id)
  const verdict1 = ra?.verdict ?? 'ABSENT'
  const verdict2 = rb?.verdict ?? 'ABSENT'
  const prop1 = (() => { const i = (ra?.rest ?? '').lastIndexOf(' — '); return i === -1 ? '' : ra.rest.slice(0, i) })()
  const prop2 = (() => { const i = (rb?.rest ?? '').lastIndexOf(' — '); return i === -1 ? '' : rb.rest.slice(0, i) })()
  const detail1 = normalize((ra?.rest ?? '').slice((ra?.rest ?? '').lastIndexOf(' — ') + 3))
  const detail2 = normalize((rb?.rest ?? '').slice((rb?.rest ?? '').lastIndexOf(' — ') + 3))
  return {
    check: id,
    proposition: prop1 || prop2,
    verdict1,
    verdict2,
    verdictAgree: verdict1 === verdict2,
    detailAgree: detail1 === detail2,
    detail1,
    detail2,
  }
})

const result = {
  schema: 'a6-run-agreement/1',
  run1: d1,
  run2: d2,
  verdictsAgree: rows.every((r) => r.verdictAgree),
  detailsAgree: rows.every((r) => r.detailAgree),
  normalization: NORMALIZATIONS.map(([name, , to]) => `${name} -> ${to}`),
  checks: rows,
}
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
for (const r of rows) {
  const mark = r.verdictAgree && r.detailAgree ? '=' : r.verdictAgree ? '~' : 'X'
  console.log(`${mark} ${r.check}  ${r.verdict1} / ${r.verdict2}${r.detailAgree ? '' : '  (detail differs)'}`)
}
console.log(`verdictsAgree=${String(result.verdictsAgree)} detailsAgree=${String(result.detailsAgree)}`)
console.log(`written: ${out}`)
if (!result.verdictsAgree) process.exit(1)
