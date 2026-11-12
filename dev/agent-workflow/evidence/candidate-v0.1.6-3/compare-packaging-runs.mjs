#!/usr/bin/env node
/**
 * compare-packaging-runs.mjs — two-run field-by-field agreement for the
 * packaging lane (`tests/kits/packaging-v016/run-packaging-acceptance.mjs`).
 *
 * Input: two evidence roots, each containing `run-<n>/summary.json` (driver
 * checks) and `run-<n>/live/summary.json` (the packaged live instrument).
 * Compares: (a) every driver check's id/ok/detail, (b) every live check's
 * id/ok/detail, (c) the artifact identities that must be equal because they
 * are properties of the packed tree (tarball sha256, installed tree digest,
 * second-tarball tree digest, rollback tree digest).
 *
 * Normalized (and only normalized): per-world identifiers, ports, timestamps,
 * run labels and absolute world paths. Artifact digests are NOT normalized —
 * a difference there is a finding.
 *
 * Usage: node compare-packaging-runs.mjs <evidence-root> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [d1, d2, out] = process.argv.slice(2)
if (!d1 || !d2 || !out) {
  console.error('usage: compare-packaging-runs.mjs <run1-dir> <run2-dir> <out.json>')
  process.exit(2)
}

const NORMALIZATIONS = [
  ['ISO timestamp', /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<iso>'],
  ['world stamp', /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/g, '<stamp>'],
  ['run label r1/r2', /\b(team-v016pack|v016-pack|packaging-v016|v016-pack-bp|v016pack)-r?[12]\b/g, '$1-<n>'],
  ['run token r1/r2', /\b(v016pack)_r[12]\b/g, '$1_r<n>'],
  ['run token R1/R2', /\bV016PACK_R[12]_/g, 'V016PACK_R<n>_'],
  ['blueprint content hash (hash over a run-labelled document)', /(contentHash[":=\s]*)(sha256:)[0-9a-f]{16,}/g, '$1sha256:<hash>'],
  ['port', /(127\.0\.0\.1:|port=|host=|mock=)(31|34|35|13)\d{2,4}\b/g, '$1<port>'],
  ['control id', /ctrl-[0-9a-z]{20,}/g, 'ctrl-<id>'],
  ['goal id', /goal-[0-9a-f]{8}-[0-9a-f-]{20,}/g, 'goal-<id>'],
  ['case id', /case-[0-9a-z]{20,}/g, 'case-<id>'],
  ['instance id', /inst-[0-9a-z]{8,}/g, 'inst-<id>'],
  ['session id', /session-[0-9a-z][0-9a-z-]*/g, 'session-<id>'],
  ['world/home path', /\/[^"\s]*tests\/homes\/[^/\s"]+/g, '<home>'],
  ['worktree path', /\/[^"\s]*\.worktrees\/[^/\s"]+/g, '<worktree>'],
  ['blueprint scratch dir', /\/[^"\s]*\.c1-smoke-blueprints-[^/\s"]*/g, '<blueprints>'],
  ['rpc id', /"rpcId":"[^"]*"/g, '"rpcId":"<id>"'],
]

function normalize(value) {
  let s = typeof value === 'string' ? value : JSON.stringify(value)
  for (const [, re, to] of NORMALIZATIONS) s = s.replace(re, to)
  return s
}

function loadRun(dir) {
  const driver = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'))
  const live = JSON.parse(readFileSync(join(dir, 'live', 'summary.json'), 'utf8'))
  return { driver, live }
}

const r1 = loadRun(d1)
const r2 = loadRun(d2)

function compareChecks(a, b, layer) {
  const mapB = new Map(b.map((c) => [c.id, c]))
  const ids = [...new Set([...a.map((c) => c.id), ...b.map((c) => c.id)])].sort()
  return ids.map((id) => {
    const ca = a.find((c) => c.id === id)
    const cb = mapB.get(id)
    const da = normalize(ca?.detail ?? '')
    const db = normalize(cb?.detail ?? '')
    return {
      layer,
      check: id,
      name: ca?.name ?? cb?.name ?? '',
      verdict1: ca ? (ca.ok ? 'PASS' : 'FAIL') : 'ABSENT',
      verdict2: cb ? (cb.ok ? 'PASS' : 'FAIL') : 'ABSENT',
      verdictAgree: Boolean(ca && cb && ca.ok === cb.ok),
      detailAgree: da === db,
      detail1: da,
      detail2: db,
    }
  })
}

const driverRows = compareChecks(r1.driver.checks, r2.driver.checks, 'driver')
const liveRows = compareChecks(r1.live.checks, r2.live.checks, 'live')
const rows = [...driverRows, ...liveRows]

const artifactIdentity = {
  tarballSha256: [r1.driver.pack?.tarballSha256, r2.driver.pack?.tarballSha256],
  tarballBytes: [r1.driver.pack?.tarballBytes, r2.driver.pack?.tarballBytes],
  packedHostEntry: [r1.live.install?.tarballHostEntrySha256, r2.live.install?.tarballHostEntrySha256],
  installedHostEntry: [r1.live.install?.installedHostEntrySha256, r2.live.install?.installedHostEntrySha256],
  secondTarballSha: [r1.driver.upgrade?.secondSha256, r2.driver.upgrade?.secondSha256],
  secondTree: [r1.driver.upgrade?.secondTreeDigest, r2.driver.upgrade?.secondTreeDigest],
  firstTree: [r1.driver.upgrade?.firstTreeDigest, r2.driver.upgrade?.firstTreeDigest],
  installedAfterSwap: [r1.driver.upgrade?.installedTreeDigestAfterSwap, r2.driver.upgrade?.installedTreeDigestAfterSwap],
  rollbackHostEntry: [r1.driver.rollback?.hostEntry, r2.driver.rollback?.hostEntry],
}
const artifactAgree = Object.fromEntries(
  Object.entries(artifactIdentity).map(([k, [a, b]]) => [k, a !== undefined && a === b]),
)

const result = {
  schema: 'packaging-run-agreement/1',
  run1: d1,
  run2: d2,
  verdictsAgree: rows.every((r) => r.verdictAgree),
  detailsAgree: rows.every((r) => r.detailAgree),
  artifactsAgree: Object.values(artifactAgree).every(Boolean),
  artifactIdentity,
  artifactAgree,
  normalization: NORMALIZATIONS.map(([name, , to]) => `${name} -> ${to}`),
  checks: rows,
}
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`)
for (const r of rows) {
  const mark = r.verdictAgree && r.detailAgree ? '=' : r.verdictAgree ? '~' : 'X'
  console.log(`${mark} [${r.layer}] ${r.check}  ${r.verdict1} / ${r.verdict2}${r.detailAgree ? '' : '  (detail differs)'}`)
}
console.log(`verdictsAgree=${String(result.verdictsAgree)} detailsAgree=${String(result.detailsAgree)} artifactsAgree=${String(result.artifactsAgree)}`)
console.log(`written: ${out}`)
if (!result.verdictsAgree || !result.artifactsAgree) process.exit(1)
