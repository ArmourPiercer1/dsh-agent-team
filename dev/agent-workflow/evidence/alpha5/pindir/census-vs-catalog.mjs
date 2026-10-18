#!/usr/bin/env node
/**
 * a5-pindir (C-16) census: the pinned reserved-native registry vs the AUTHORITATIVE
 * catalog harvest of the pinned host release.
 *
 * Authoritative source (root 20:31Z, unit B ③): the host tool-catalog guarantee
 * chain — `scripts/gen-tool-catalog.ts` boots every shipped tool-* package and
 * harvests the model-facing names (guarantee spec:
 * `packages/core/tools/tests/gen-tool-catalog.spec.ts`); `docs/tool-catalog.md`
 * is that harvest's committed artifact, regenerated and `--check`-verified by the
 * host's own doc-sync at the pinned commit. Consuming the artifact at the pinned
 * tree IS reusing the harvest mechanism (booting the host workspace from this
 * repo's vitest is not possible; the artifact freshness is the host's guarantee).
 * Caliber: model-visible release names = the schemas column ∪ the shippedNames
 * column (the generator's documented alias caliber: "The registered tool NAME can
 * be a load-time config ... a per-package note records those shipped aliases";
 * `subagent_fork` lives exactly there — boot-harvest names miss it, the artifact
 * carries it). The `mcp__` family is prefix-pinned, not enumerated.
 *
 * Law: FORWARD (catalog name not pinned) = missing pin = RED. REVERSE (pinned
 * name not in the catalog) must carry an explicit reason — never silent.
 *
 * Usage: node census-vs-catalog.mjs <repo-root>   (reads the pinned host tree +
 * the worktree's team-tool-plane.mjs; prints the census; exit 1 on forward drift)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(process.argv[2] ?? '.')
const { TEST_USE_REL, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION, findTestRepoRoot } = await import(
  new URL(path.join('file://', ROOT, 'tests/paths.mjs')).href
)
// the host checkout lives at the resolved test repo root (a task worktree walks
// up to the main checkout — the same resolution every runtime test uses).
const HOST_ROOT = findTestRepoRoot(ROOT)
if (!HOST_ROOT) { console.error('no tests/deepseek-harness-test-use reachable from ' + ROOT); process.exit(2) }
const host = path.join(HOST_ROOT, TEST_USE_REL)
const hostSha = execFileSync('git', ['-C', host, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (hostSha !== TEST_USE_BASELINE_SHA) {
  console.error(`host tree moved: ${hostSha} != pinned ${TEST_USE_BASELINE_SHA} — re-derive, do not proceed`)
  process.exit(2)
}
const doc = readFileSync(path.join(host, 'docs/tool-catalog.md'), 'utf8')
const catalog = new Set()
const rows = []
for (const line of doc.split('\n')) {
  if (!/^\|\s*`@deepseek/.test(line)) continue
  const cols = line.split('|').map((s) => s.trim())
  // columns: ['', pkg, schemas, requires, writes, shippedNames, note, '']
  const pkg = (cols[1] ?? '').replace(/`/g, '')
  // every row splits into exactly 8 fields (cells carry no pipes): the shippedNames
  // column is the 5th cell; the 6th is the note (free text — never harvested).
  if (cols.length !== 8) { console.error(`row with unexpected field count: ${pkg}`); process.exit(2) }
  const names = []
  for (const c of [cols[2], cols[5]]) {
    if (!c || c === '-') continue
    for (const m of c.matchAll(/`([^`]+)`/g)) names.push(m[1])
  }
  rows.push({ pkg, names })
  for (const n of names) catalog.add(n)
}
// shippedNames lives at cols[6]; verify the column layout held (the 6-field law):
for (const r of rows) if (r.names.length === 0) { console.error(`row with no names: ${r.pkg}`); process.exit(2) }
const src = readFileSync(path.join(ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs'), 'utf8')
const arr = src.match(/PLANE_RESERVED_NATIVE = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1]
if (!arr) { console.error('PLANE_RESERVED_NATIVE array not found'); process.exit(2) }
const pinned = [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1])
const pin = new Set(pinned)
if (pin.size !== pinned.length) { console.error('duplicate pin'); process.exit(2) }
const forward = [...catalog].filter((n) => !pin.has(n)).sort()
const reverse = pinned.filter((n) => !catalog.has(n)).sort()
console.log(`host: ${DSH_BASELINE_VERSION}@${hostSha.slice(0, 10)} (pinned, verified)`)
console.log(`catalog harvest names (schemas ∪ shippedNames, mcp__ family excluded): ${catalog.size}`)
console.log(`pinned exact names: ${pinned.length}`)
console.log(`FORWARD (in catalog, NOT pinned — missing pin, RED): ${forward.length} ${JSON.stringify(forward)}`)
console.log(`REVERSE (pinned, NOT in catalog — needs explicit reason): ${reverse.length} ${JSON.stringify(reverse)}`)
process.exit(forward.length > 0 ? 1 : 0)
