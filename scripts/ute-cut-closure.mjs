#!/usr/bin/env node
/**
 * ute-cut-closure.mjs — the A1 deletion's DEPENDENCY CLOSURE, computed against a FROZEN
 * boundary rather than against whatever happens to be on disk.
 *
 * WHY THIS EXISTS. A deletion inventory is not a closure. `ute-p0-assets` answers "which files
 * belong to the modules we are retiring"; it cannot answer "what still points at them". The
 * first review of A0 found four live references a `git ls-files` inventory cannot see —
 *
 *   - `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` reaches five shadows through
 *     `new URL('./confined-*.mjs', import.meta.url)` (dynamic; invisible to a static scan);
 *   - `packages/runtime/operation-permission/index.ts` RE-EXPORTS `pre-execute-adapter.ts`,
 *     so a module we marked KEEP would dangle;
 *   - `scripts/dist-placements/*.json` still place retired shadows into the built tree;
 *   - committed dist artifacts still ship the deleted modules.
 *
 * WHY IT RESOLVES AGAINST THE SNAPSHOT. The first version resolved a specifier with
 * `existsSync` and gave up when nothing was there. That is exactly backwards for a post-
 * deletion check: once A1 deletes `confined-fs-tool.mjs`, a surviving
 * `new URL('./confined-fs-tool.mjs', …)` would resolve to null and vanish from the report —
 * the check would go green *because* the deletion worked. Resolution is therefore textual
 * (candidate paths), and membership is decided against the FROZEN delete set from the A0
 * snapshot, where a deleted target is still a target.
 *
 * CLASSIFICATION. A reference only matters when the REFERRER survives the cut:
 *
 *   production  `packages/**` sources, `apps/**` — enumerated, each with a declared disposition
 *   exempt      a named test/evidence file registered in `ute-cut-closure.allow.json` with a
 *               reason. No directory gets a blanket exemption: registering a file is a
 *               reviewed act, and an unregistered referrer is a finding.
 *   tooling     `scripts/**`, `dev/ci/**` — generators and placements that name retired files
 *   dist        committed build output for a deleted source — must be deleted with it
 *
 * Usage:
 *   node scripts/ute-cut-closure.mjs --check    # report agreement + exemptions + cut zeros
 *   node scripts/ute-cut-closure.mjs --write    # regenerate the report
 *   node scripts/ute-cut-closure.mjs --json
 *   node scripts/ute-cut-closure.mjs --check --root <dir>   # another checkout (negative control)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const REPORT_PATH = 'dev/agent-workflow/ledgers/ute-cut-closure.json'
const LEDGER_PATH = 'dev/agent-workflow/ledgers/ute-p0-assets.json'
const SNAPSHOT_PATH = 'dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json'
const EXEMPTIONS_PATH = 'dev/agent-workflow/ledgers/ute-cut-closure.allow.json'
const DISPOSITIONS_PATH = 'dev/agent-workflow/ledgers/ute-cut-closure.dispositions.json'

/**
 * DISPOSITIONS. The closure is only useful if every surviving production reference has a
 * DECLARED fate. A production referrer with no entry turns `--check` red, so "we will deal
 * with it during the cut" cannot be the answer for a file nobody looked at.
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

const git = (args, cwd = ROOT) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()
const isText = (p) => /\.(mjs|cjs|js|ts|mts|cts|json|ya?ml|md|sh|txt)$/.test(p)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const bookedNames = (ledger) => [...new Set(ledger.modules.flatMap((m) => m.names ?? []))].sort()

/** The frozen boundary: every path A0 declared deletable, plus the names it covered. */
export function loadFrozen (root = ROOT) {
  const ledger = JSON.parse(readFileSync(join(root, LEDGER_PATH), 'utf8'))
  const ledgerDeleted = new Set(
    ledger.modules.filter((m) => m.verdict === 'delete' || m.verdict === 'replace').flatMap((m) => m.files),
  )
  const snapPath = join(root, SNAPSHOT_PATH)
  if (existsSync(snapPath)) {
    const snap = JSON.parse(readFileSync(snapPath, 'utf8'))
    const snapDeleted = new Set(
      (snap.modules ?? []).filter((m) => m.verdict === 'delete' || m.verdict === 'replace').flatMap((m) => m.files),
    )
    // The snapshot is the attestation. If it and the ledger disagree the assets gate is
    // already red; resolving against the snapshot keeps a deletion from shrinking the target.
    if (snapDeleted.size !== 0) return { deleted: snapDeleted, names: bookedNames(ledger), from: SNAPSHOT_PATH }
  }
  return { deleted: ledgerDeleted, names: bookedNames(ledger), from: LEDGER_PATH }
}

/** Resolve a relative specifier to the candidate repo-relative paths it could denote. */
export function resolveCandidates (fromFile, spec) {
  if (!spec.startsWith('.')) return []
  const base = normalize(join(dirname(fromFile), spec)).replace(/\\/g, '/')
  const stem = base.replace(/\.(mjs|js|mts|ts)$/, '')
  const out = [
    base,
    `${stem}.ts`, `${stem}.mjs`, `${stem}.js`, `${stem}.mts`, `${stem}.d.mts`, `${stem}.json`,
    `${stem}/index.ts`, `${stem}/index.mjs`, `${stem}/index.js`,
  ]
  return [...new Set(out)]
}

/** Convenience: the first candidate that exists right now (unit arms, ad-hoc inspection). */
export function resolveSpecifier (fromFile, spec, root = ROOT) {
  for (const c of resolveCandidates(fromFile, spec)) if (existsSync(join(root, c))) return c
  return null
}

/** Extract module specifiers from one file's text. */
export function specifiersOf (text) {
  const out = new Set()
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /^\s*import\s+['"]([^'"]+)['"]/gm, // side-effect import: no `from`, still a reference
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
  ]
  for (const re of patterns) for (const m of text.matchAll(re)) out.add(m[1])
  return [...out]
}

const isTestPath = (file) =>
  file.startsWith('tests/') ||
  file.startsWith('dev/agent-workflow/evidence/') ||
  /(^|\/)(test|__tests__|tests)\//.test(file) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)

const classOf = (file) => {
  if (file.startsWith('packages/') && file.includes('/dist/')) return 'dist'
  // Role, not directory: a test file that happens to live under a package is a test, and a
  // test is never silently exempt — see the registration requirement in --check.
  if (isTestPath(file)) return 'test'
  if (file.startsWith('packages/') || file.startsWith('apps/')) return 'production'
  if (file.startsWith('scripts/') || file.startsWith('dev/ci/')) return 'tooling'
  return 'other'
}

/**
 * The committed disposition registry. It lives in a file, not only in this script, so that a
 * reviewer can see every surviving production reference and its fate in one diff, and so that
 * a checkout other than this one (the negative-control repos in the tests) can declare its own.
 */
export function loadDispositions (root = ROOT) {
  const p = join(root, DISPOSITIONS_PATH)
  if (!existsSync(p)) return DISPOSITIONS
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  const out = {}
  for (const [path, d] of Object.entries(raw.entries ?? {})) out[path] = d
  return out
}

/** Committed exemption registry: exact paths, each with a reason and a subject. */
export function loadExemptions (root = ROOT) {
  const p = join(root, EXEMPTIONS_PATH)
  if (!existsSync(p)) return new Map()
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  const m = new Map()
  for (const e of raw.entries ?? []) m.set(e.path, e)
  return m
}

/** Is a committed dist artifact the build output of a deleted source? */
export function distCounterpartsOf (source) {
  const m = /^packages\/([^/]+)\/(.+)$/.exec(source)
  if (m === null) return []
  const [, pkg, rest] = m
  if (rest.startsWith('dist/')) return []
  const stem = rest.replace(/\.(ts|mts|tsx|mjs)$/, '')
  const dir = `packages/${pkg}/dist/packages/${pkg}/${stem}`
  return [`${dir}.js`, `${dir}.d.ts`, `${dir}.js.map`, `${dir}.d.ts.map`]
}

/**
 * Static pre-filter for duplicate model-visible declarations. The authoritative check is the
 * binding assembler's refusal at B; A1 should still not ship a realm where a booked name has
 * two declarants, so this counts surviving files that define a tool AND name it.
 */
export function duplicateDeclarants (root, names) {
  const tracked = git(['ls-files'], root).split('\n').filter(Boolean)
  const counts = new Map()
  for (const file of tracked) {
    if (!isText(file)) continue
    // Production only. Test files mention booked names inside fixtures and expectations, and
    // evidence files quote PR bodies; counting those as declarants would make the arm noise.
    if (classOf(file) !== 'production') continue
    let text
    try { text = readFileSync(join(root, file), 'utf8') } catch { continue }
    if (!/\bdefineTool\s*\(|\bToolDefinition\b/.test(text)) continue
    for (const n of names) {
      if (new RegExp(`name:\\s*['"\`]${esc(n)}['"\`]`).test(text)) {
        counts.set(n, [...(counts.get(n) ?? []), file])
      }
    }
  }
  return [...counts].filter(([, files]) => files.length > 1).map(([name, files]) => ({ name, files }))
}

export function deriveClosure ({ root = ROOT } = {}) {
  const frozen = loadFrozen(root)
  const exemptions = loadExemptions(root)
  const tracked = git(['ls-files'], root).split('\n').filter(Boolean)
  const findings = []
  for (const file of tracked) {
    if (!isText(file)) continue
    if (frozen.deleted.has(file)) continue // goes with the cut
    if (classOf(file) === 'dist') continue // the dist arm below covers it
    let text
    try { text = readFileSync(join(root, file), 'utf8') } catch { continue }
    for (const spec of specifiersOf(text)) {
      const target = resolveCandidates(file, spec).find((c) => frozen.deleted.has(c))
      if (target === undefined) continue
      const exempt = exemptions.get(file)
      findings.push({
        referrer: file,
        target,
        spec,
        class: classOf(file),
        ...(exempt === undefined ? {} : { exemptBy: exempt.reason }),
      })
    }
  }
  const distResiduals = []
  for (const source of frozen.deleted) {
    for (const d of distCounterpartsOf(source)) {
      if (tracked.includes(d)) distResiduals.push({ source, artifact: d })
    }
  }
  const onDisk = [...frozen.deleted].filter((f) => existsSync(join(root, f)))
  // pending: nothing deleted yet; cut: everything gone; partial: in between (a named RED).
  const state = onDisk.length === frozen.deleted.size ? 'pending' : onDisk.length === 0 ? 'cut' : 'partial'
  return {
    frozenFrom: frozen.from,
    deletedCount: frozen.deleted.size,
    findings,
    distResiduals,
    cut: {
      state,
      retiredSourcesOnDisk: onDisk.length,
      survivingProductionRefs: findings.filter((f) => f.class === 'production').length,
      retiredDistArtifacts: distResiduals.length,
      duplicateDeclarants: duplicateDeclarants(root, frozen.names),
    },
  }
}

const groupOf = (f) => {
  if (f.class === 'production') return 'production'
  if (f.class === 'tooling') return 'tooling'
  return f.exemptBy === undefined ? 'exempt:UNREGISTERED' : 'exempt'
}

const summarise = (findings) => {
  const g = new Map()
  for (const f of findings) {
    const k = groupOf(f)
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(f)
  }
  return [...g].sort((a, b) => b[1].length - a[1].length)
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!isMain) {
  // importable: tests use the exported derivations
} else {
  const argv = process.argv.slice(2)
  const rootArg = argv.indexOf('--root')
  const root = rootArg === -1 ? ROOT : resolve(argv[rootArg + 1])
  const out = deriveClosure({ root })
  const reportPath = join(root, REPORT_PATH)

  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n')
    process.exit(0)
  }
  if (argv.includes('--write')) {
    writeFileSync(reportPath, JSON.stringify({
      schema: 'ute-cut-closure/1',
      derivedFrom: 'textual specifier resolution vs the FROZEN A0 delete set',
      frozenFrom: out.frozenFrom,
      deletedCount: out.deletedCount,
      groups: summarise(out.findings).map(([k, v]) => ({ group: k, count: v.length, referrers: [...new Set(v.map((x) => x.referrer))].sort() })),
      dispositions: loadDispositions(root),
      distResiduals: out.distResiduals,
      cut: { state: out.cut.state, retiredSourcesOnDisk: out.cut.retiredSourcesOnDisk },
    }, null, 2) + '\n')
    console.log(
      `UTE-CUT-CLOSURE write deleted=${out.deletedCount} references=${out.findings.length} ` +
      `distResiduals=${out.distResiduals.length} cut=${out.cut.state} dupNames=${out.cut.duplicateDeclarants.length}`,
    )
    process.exit(0)
  }
  if (!argv.includes('--check')) {
    console.error('usage: node scripts/ute-cut-closure.mjs --check|--write|--json [--root <dir>]')
    process.exit(2)
  }

  const findings = []
  if (!existsSync(reportPath)) {
    findings.push({ code: 'UTE_CLOSURE_REPORT_MISSING', detail: `${REPORT_PATH} is missing — run --write` })
  } else {
    const committed = JSON.parse(readFileSync(reportPath, 'utf8'))
    const fresh = summarise(out.findings).map(([k, v]) => ({ group: k, count: v.length }))
    const stored = (committed.groups ?? []).map(({ group: k, count }) => ({ group: k, count }))
    if (JSON.stringify(fresh) !== JSON.stringify(stored)) {
      findings.push({ code: 'UTE_CLOSURE_STALE', detail: `closure report drifted: stored ${JSON.stringify(stored)} fresh ${JSON.stringify(fresh)}` })
    }
    if ((committed.distResiduals ?? []).length !== out.distResiduals.length) {
      findings.push({ code: 'UTE_CLOSURE_DIST_STALE', detail: `dist residuals stored ${committed.distResiduals?.length} fresh ${out.distResiduals.length}` })
    }
  }

  // THE BUILD'S OWN INPUTS. A cut that moves the production entry must move everything that NAMES it,
  // or `place-dist-glue` dies on a missing source and the product cannot be built at all - while every
  // source-tree test stays green, which is precisely how this went unnoticed once (2026-11-22: 99 of
  // 119 placement sources were files the cut had already deleted, and the glue path still pointed at
  // packages/runtime/src/plugin/live/agent-bindings.mjs).
  // The module EVALUATES its list at import time, and the loader refuses a list whose first entry is
  // not the glue — so a moved entry surfaces as a THROW from the import itself. That is still a
  // finding, not a crash: a gate that dies with a stack trace tells the operator nothing about which
  // invariant broke.
  let placementLoader
  let placements = []
  try {
    placementLoader = await import('./place-dist-glue.mjs')
    placements = placementLoader.loadPlacements()
  } catch (error) {
    findings.push({ code: 'UTE_CLOSURE_DIST_PLACEMENTS_UNREADABLE', detail: `the dist placement list cannot be loaded: ${error instanceof Error ? error.message : String(error)}` })
  }
  if (placementLoader !== undefined && !existsSync(join(root, placementLoader.GLUE_SRC))) {
    findings.push({ code: 'UTE_CLOSURE_GLUE_PATH', detail: `place-dist-glue's GLUE_SRC ${placementLoader.GLUE_SRC} does not exist — the production entry moved and the build was not told` })
  }
  for (const placement of placements) {
    if (!existsSync(join(root, placement.src))) {
      findings.push({ code: 'UTE_CLOSURE_DIST_PLACEMENT_MISSING', detail: `${placement.src} is a declared dist placement but does not exist; place-dist-glue cannot build the shipped face from it` })
    }
  }

  // Every non-production referrer must be REGISTERED by path. A directory is not a reason.
  const exemptions = loadExemptions(root)
  for (const f of out.findings) {
    if (f.class === 'production' || f.class === 'tooling') continue
    if (!exemptions.has(f.referrer)) {
      findings.push({ code: 'UTE_CLOSURE_UNREGISTERED_EXEMPTION', detail: `${f.referrer} refers to ${f.target} but is not registered in ${EXEMPTIONS_PATH}` })
    }
  }
  const used = new Set(out.findings.map((f) => f.referrer))
  for (const path of exemptions.keys()) {
    if (!used.has(path)) findings.push({ code: 'UTE_CLOSURE_STALE_EXEMPTION', detail: `${path} is registered but no longer refers to the delete set — remove it` })
  }
  const dispositions = loadDispositions(root)
  for (const referrer of [...new Set(out.findings.filter((f) => f.class === 'production').map((f) => f.referrer))].sort()) {
    const d = dispositions[referrer]
    if (d === undefined) {
      findings.push({ code: 'UTE_CLOSURE_UNDISPOSED', detail: `${referrer} references the delete set but has no disposition (rewire | replace | delete-with-group + a note)` })
    } else if (!['rewire', 'replace', 'delete-with-group'].includes(d.disposition) || typeof d.note !== 'string' || d.note.length < 40) {
      findings.push({ code: 'UTE_CLOSURE_WEAK_DISPOSITION', detail: `${referrer}: a disposition needs rewire|replace|delete-with-group and a real note` })
    }
  }

  // Cut completion: four zeros — but only once the cut has started. `pending` is a legitimate
  // state (A0 freezes the plan); `partial` is a named RED, because a half-cut realm declares
  // every name twice.
  const { cut } = out
  if (cut.state === 'partial') {
    findings.push({
      code: 'UTE_CLOSURE_PARTIAL',
      detail: `half-cut: ${cut.retiredSourcesOnDisk} retired source(s) still on disk — a half-cut realm declares names twice`,
    })
  }
  if (cut.state === 'cut') {
    if (cut.retiredSourcesOnDisk !== 0) findings.push({ code: 'UTE_CLOSURE_RETIRED_SOURCE', detail: `${cut.retiredSourcesOnDisk} retired source(s) still on disk` })
    if (cut.survivingProductionRefs !== 0) findings.push({ code: 'UTE_CLOSURE_PRODUCTION_REF', detail: `${cut.survivingProductionRefs} production reference(s) still resolve into the delete set` })
    if (cut.retiredDistArtifacts !== 0) findings.push({ code: 'UTE_CLOSURE_DIST_ARTIFACT', detail: `${cut.retiredDistArtifacts} committed dist artifact(s) still ship a retired source` })
    if (cut.duplicateDeclarants.length !== 0) {
      findings.push({ code: 'UTE_CLOSURE_DUPLICATE_DECLARANT', detail: cut.duplicateDeclarants.map((d) => `${d.name}: ${d.files.join(', ')}`).join(' | ') })
    }
  }

  for (const f of findings) console.error(`${f.code} ${f.detail}`)
  console.log(
    `UTE-CUT-CLOSURE ${findings.length === 0 ? 'pass' : 'fail'} deleted=${out.deletedCount} references=${out.findings.length} ` +
    `prodRefs=${cut.survivingProductionRefs} distResiduals=${out.distResiduals.length} ` +
    `cut=${cut.state}(${cut.retiredSourcesOnDisk}/${out.deletedCount}) dupNames=${cut.duplicateDeclarants.length} findings=${findings.length}`,
  )
  process.exit(findings.length === 0 ? 0 : 1)
}
