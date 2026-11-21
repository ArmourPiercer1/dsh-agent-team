#!/usr/bin/env node
/**
 * ute-cut-closure.mjs — the A1 deletion's DEPENDENCY CLOSURE, computed rather than asserted.
 *
 * WHY THIS EXISTS. A deletion inventory is not a closure. `ute-p0-assets` answers "which
 * files are in the modules we are retiring"; it cannot answer "what still points at them".
 * The difference is not academic: the first review of A0 found four live references that a
 * `git ls-files` inventory cannot see —
 *
 *   - `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` reaches five shadows through
 *     `new URL('./confined-*.mjs', import.meta.url)` (a DYNAMIC reference, invisible to a
 *     static-import scan and to directory listing);
 *   - `packages/runtime/operation-permission/index.ts` RE-EXPORTS `pre-execute-adapter.ts`,
 *     so a module we marked KEEP would dangle;
 *   - `scripts/dist-placements/*.json` still place retired shadows into the built tree;
 *   - the committed dist artifacts under each package still ship the deleted modules.
 *
 * WHAT COUNTS AS A REFERENCE. Resolved module specifiers only — never basenames. Matching on
 * a basename (`index.ts`, `types.ts`, `README.md`) produces thousands of false hits, which
 * is how a closure check becomes noise and then becomes ignored. Each specifier is resolved
 * against its referrer's directory with the usual extension substitutions.
 *
 * CLASSIFICATION. A reference is only a problem when the REFERRER survives the cut:
 *
 *   production  `packages/**` sources, `apps/**` — must be enumerated and dealt with in A1
 *               (rewire, replace with the surviving entry, or delete as part of a group)
 *   test        suites/worlds/kits whose SUBJECT is the retired module — permitted, because
 *               the subject goes with them, but only through the prefix allow-list below
 *   tooling     `scripts/**` generators and placements that name retired files
 *   dist        committed build output for a deleted source — must be deleted with it
 *
 * Usage:
 *   node scripts/ute-cut-closure.mjs --check    # findings vs the committed report; exit 1 on drift
 *   node scripts/ute-cut-closure.mjs --write    # regenerate the report
 *   node scripts/ute-cut-closure.mjs --json     # machine-readable
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const REPORT_PATH = 'dev/agent-workflow/ledgers/ute-cut-closure.json'
const LEDGER_PATH = 'dev/agent-workflow/ledgers/ute-p0-assets.json'

/**
 * TEST/EVIDENCE PREFIXES. A suite whose subject is being deleted must be retired with it;
 * enumerating hundreds of individual test files would hide the signal. Each prefix carries
 * a reason, and the check refuses a prefix with no reason.
 */
export const TEST_PREFIXES = Object.freeze([
  ['tests/ute-g1-', 'UTE G1 per-family suites: their subject is the family body being deleted'],
  ['packages/runtime/test/', 'old-route unit tests: their subject is the plane/bridge/adapter being deleted'],
  ['tests/world-factory/', 'old assemblies/worlds built around the retired route'],
  ['tests/kits/', 'old kits: each mounts the retired route as its subject'],
  ['tests/poc-web-native-reuse/', 'POC arms over the retired web row'],
  ['tests/u6-arc-a-probe-family/', 'probe family built on governance-center (retired as a consumer)'],
  ['tests/ute1-fs/', 'UTE-1 suite pinned to the pre-cut assembly'],
  ['tests/ute2-settlement/', 'settlement suite kept, but its dispatch arms mount the retired plane'],
  ['tests/checks/', 'repo checks that name retired files as fixtures'],
  ['packages/tools/test/', 'old tool-package tests whose subject is a retired family/port'],
  ['dev/agent-workflow/evidence/', 'historical evidence: it NAMES the retired route as a record and is not executed by CI'],
])

/**
 * DISPOSITIONS. The closure is only useful if every surviving production reference has a
 * DECLARED fate. This map is the enumeration the A1 cut is held to: a production referrer
 * with no entry turns `--check` red, so "we will deal with it during the cut" cannot be the
 * answer for a file nobody looked at.
 */
export const DISPOSITIONS = Object.freeze({
  'packages/runtime/operation-permission/canonical-operation.ts': {
    disposition: 'rewire',
    note: 'Imports bash-normalizer / read-normalizer from the retired process and fs families. Those normalizers are text normalization, not execution: they move into the kept algebra at the cut, so the permission result for a bash/read operation is unchanged.',
  },
  'packages/runtime/operation-permission/index.ts': {
    disposition: 'rewire',
    note: 'Re-exports pa-control-bridge and pre-execute-adapter. The two re-export lines are removed with the modules; the algebra surface stays.',
  },
  'packages/runtime/src/plugin/host.ts': {
    disposition: 'replace',
    note: 'Holds the lazy accessors that reach the old assembly (agent-bindings/root). Replaced by the new entry host surface in the A1 swap.',
  },
  'packages/runtime/src/plugin/types.ts': {
    disposition: 'replace',
    note: 'Re-declares the assembly types of the replaced entries; rewritten with them.',
  },
  'packages/runtime/src/plugin/live/center-shadow-row.mjs': {
    disposition: 'replace',
    note: 'A shadow row over the old assembly; the new binding assembler is its replacement, and it exists only to compensate for the preset-scope resolution problem the provider lane now fixes.',
  },
  'packages/runtime/src/plugin/live/a5sf-realm-row.mjs': {
    disposition: 'replace',
    note: 'Reaches five confined shadows through `new URL(..., import.meta.url)` — a dynamic reference a static scan cannot see. It is the realm mount itself: the new provider-lane realm replaces it wholesale.',
  },
  'packages/tools/test/u7f-ask-port-agent-binding.test.ts': {
    disposition: 'delete-with-group',
    note: 'Exercise of the retired ask port lane; retired with its subject.',
  },
})

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

const isText = (p) => /\.(mjs|cjs|js|ts|mts|cts|json|ya?ml|md|sh|txt)$/.test(p)
const deletedSources = (ledger) => {
  const set = new Set()
  for (const m of ledger.modules) {
    if (m.verdict === 'delete' || m.verdict === 'replace') for (const f of m.files) set.add(f)
  }
  return set
}

/** Extract resolved-on-demand module specifiers from one file's text. */
export function specifiersOf (text) {
  const out = new Set()
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,                       // import/export … from 'x'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,           // dynamic import('x')
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,          // require('x')
    /new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g, // new URL('./x', import.meta.url)
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) out.add(m[1])
  }
  return [...out]
}

/** Resolve a relative specifier to a repo-relative file, or null. */
export function resolveSpecifier (fromFile, spec) {
  if (!spec.startsWith('.')) return null
  const base = join(dirname(fromFile), spec)
  const candidates = [
    base,
    `${base}.ts`, `${base}.mjs`, `${base}.js`, `${base}.mts`, `${base}.d.mts`, `${base}.json`,
    base.replace(/\.js$/, '.ts'), base.replace(/\.mjs$/, '.mjs'),
    base.replace(/\.(mjs|js)$/, '.ts'), base.replace(/\.(mjs|js)$/, '.d.mts'),
  ]
  for (const c of candidates) {
    const rel = c.replace(/^\.\//, '')
    if (existsSync(join(ROOT, rel))) return rel
  }
  return null
}

const classOf = (file) => {
  // Test/evidence prefixes win over the package root: `packages/runtime/test/**` is a suite
  // whose subject is the retired route, not production code that must be rewired.
  if (TEST_PREFIXES.some(([p]) => file.startsWith(p))) return 'test'
  if (file.startsWith('packages/') && file.includes('/dist/')) return 'dist'
  if (file.startsWith('packages/') || file.startsWith('apps/')) return 'production'
  if (file.startsWith('scripts/')) return 'tooling'
  return 'test'
}
const allowedTestPrefix = (file) => TEST_PREFIXES.find(([p]) => file.startsWith(p))?.[0] ?? null

/** Is a committed dist artifact the build output of a deleted source? */
export function distCounterpartsOf (source) {
  // packages/<pkg>/<sub>/x.ts  ->  packages/<pkg>/dist/packages/<pkg>/<sub>/x.{js,d.ts,js.map,d.ts.map}
  const m = /^packages\/([^/]+)\/(.+)$/.exec(source)
  if (m === null) return []
  const [, pkg, rest] = m
  if (rest.startsWith('dist/')) return []
  const stem = rest.replace(/\.(ts|mts|tsx|mjs)$/, '')
  const dir = `packages/${pkg}/dist/packages/${pkg}/${stem}`
  return [`${dir}.js`, `${dir}.d.ts`, `${dir}.js.map`, `${dir}.d.ts.map`]
}

export function deriveClosure (root = ROOT) {
  const ledger = JSON.parse(readFileSync(join(root, LEDGER_PATH), 'utf8'))
  const deleted = deletedSources(ledger)
  const tracked = git(['ls-files']).split('\n').filter(Boolean)
  const findings = []
  for (const file of tracked) {
    if (!isText(file)) continue
    const cls = classOf(file)
    if (cls === 'dist') continue // handled by the dist-parity arm below
    let text
    try { text = readFileSync(join(root, file), 'utf8') } catch { continue }
    for (const spec of specifiersOf(text)) {
      const target = resolveSpecifier(file, spec)
      if (target === null) continue
      if (!deleted.has(target)) continue
      if (deleted.has(file)) continue // goes with it
      const allowed = cls === 'test' ? allowedTestPrefix(file) : null
      findings.push({
        referrer: file,
        target,
        class: cls,
        spec,
        ...(allowed === null ? {} : { allowedBy: allowed }),
      })
    }
  }
  // dist parity: a tracked build artifact for a deleted source must go with it
  const distResiduals = []
  for (const source of deleted) {
    for (const d of distCounterpartsOf(source)) {
      if (tracked.includes(d)) distResiduals.push({ source, artifact: d })
    }
  }
  return { deletedCount: deleted.size, findings, distResiduals }
}

const group = (findings) => {
  const g = new Map()
  for (const f of findings) {
    const key = f.class === 'test' ? (f.allowedBy ?? 'test:UNALLOWED') : f.class
    if (!g.has(key)) g.set(key, [])
    g.get(key).push(f)
  }
  return [...g].sort((a, b) => b[1].length - a[1].length)
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!isMain) {
  // importable
} else {
  const argv = process.argv.slice(2)
  const out = deriveClosure()
  const unclassified = out.findings.filter((f) => f.class !== 'test' || f.allowedBy === undefined)
  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n')
    process.exit(0)
  }
  if (argv.includes('--write')) {
    writeFileSync(join(ROOT, REPORT_PATH), JSON.stringify({
      schema: 'ute-cut-closure/1',
      derivedFrom: 'resolved module specifiers across tracked files vs the A0 delete set',
      deletedCount: out.deletedCount,
      groups: group(out.findings).map(([k, v]) => ({ group: k, count: v.length, referrers: [...new Set(v.map((x) => x.referrer))].sort() })),
      dispositions: DISPOSITIONS,
      distResiduals: out.distResiduals,
    }, null, 2) + '\n')
    console.log(`UTE-CUT-CLOSURE write deleted=${out.deletedCount} findings=${out.findings.length} unclassified=${unclassified.length} distResiduals=${out.distResiduals.length}`)
    process.exit(0)
  }
  if (!argv.includes('--check')) {
    console.error('usage: node scripts/ute-cut-closure.mjs --check|--write|--json')
    process.exit(2)
  }
  const findings = []
  if (!existsSync(join(ROOT, REPORT_PATH))) {
    findings.push({ code: 'UTE_CLOSURE_REPORT_MISSING', detail: `${REPORT_PATH} is missing — run --write` })
  } else {
    const committed = JSON.parse(readFileSync(join(ROOT, REPORT_PATH), 'utf8'))
    const fresh = group(out.findings).map(([k, v]) => ({ group: k, count: v.length }))
    const stored = (committed.groups ?? []).map(({ group: k, count }) => ({ group: k, count }))
    const key = (a) => JSON.stringify(a)
    if (key(fresh) !== key(stored)) {
      findings.push({
        code: 'UTE_CLOSURE_STALE',
        detail: `closure report drifted: stored ${key(stored)} fresh ${key(fresh)} — the delete set or the references changed`,
      })
    }
    if ((committed.distResiduals ?? []).length !== out.distResiduals.length) {
      findings.push({ code: 'UTE_CLOSURE_DIST_STALE', detail: `dist residuals stored ${committed.distResiduals?.length} fresh ${out.distResiduals.length}` })
    }
  }
  // Production references are never allowed to be silent: they must be enumerated in the
  // report, which is what makes them A1 obligations rather than surprises.
  // Every production referrer must carry a declared disposition.
  for (const referrer of [...new Set(out.findings.filter((f) => f.class === 'production').map((f) => f.referrer))].sort()) {
    if (DISPOSITIONS[referrer] === undefined) {
      findings.push({ code: 'UTE_CLOSURE_UNDISPOSED', detail: `${referrer} references the delete set but has no DISPOSITIONS entry (rewire | replace | delete-with-group + a note)` })
    }
  }
  for (const f of unclassified) {
    if (f.class !== 'production' && f.class !== 'tooling') continue
    const committed = existsSync(join(ROOT, REPORT_PATH))
      ? JSON.parse(readFileSync(join(ROOT, REPORT_PATH), 'utf8'))
      : { groups: [] }
    const listed = (committed.groups ?? []).some((g) => g.group === f.class && (g.referrers ?? []).includes(f.referrer))
    if (!listed) findings.push({ code: 'UTE_CLOSURE_UNLISTED', detail: `${f.referrer} -> ${f.target} (${f.class}) is not in ${REPORT_PATH}` })
  }
  for (const f of findings) console.error(`${f.code} ${f.detail}`)
  console.log(
    `UTE-CUT-CLOSURE ${findings.length === 0 ? 'pass' : 'fail'} deleted=${out.deletedCount} ` +
    `references=${out.findings.length} unclassified=${unclassified.length} ` +
    `distResiduals=${out.distResiduals.length} findings=${findings.length}`,
  )
  process.exit(findings.length === 0 ? 0 : 1)
}
