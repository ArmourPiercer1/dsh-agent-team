#!/usr/bin/env node
/**
 * test-catalog.mjs — Test Catalog (M1 discovery; M6 dispatch authority).
 *
 * WHAT IT IS
 *   A census of every test the repository actually owns, with a digest, a
 *   critical-contract binding check, a two-way diff against what CI declares,
 *   and — since M6 — the ONE definition of "this file is a node:test suite"
 *   (`isNodeSuitePath`) that `scripts/dispatch-tests.mjs` resolves a CI leg
 *   against. A leg's population is declared once in `dev/ci/eb3-ci-manifest.json`
 *   (`suites[]` for an explicit subset, `areas[]` for a whole directory); the
 *   workflow names only the leg, so the twin file list the old legs needed is
 *   gone.
 *
 * WHAT IT IS NOT
 *   It is not the declaration of WHICH suites a leg runs: that is the manifest
 *   leg, and the dispatcher refuses to run anything the catalog cannot classify
 *   as a collected node:test suite. Discovery is the authority for "is a test",
 *   the manifest leg for "is in this leg", and CI driver for "is collected".
 *   Two copies of a file list would be worse than one, which is why the workflow
 *   copy was deleted.
 *
 * DISCOVERY (no hand-written list)
 *   - vitest: `*.test.ts` matched by ANY vitest config in the repo — the root
 *     `vitest.config.ts` plus each per-package `vitest.config.ts`, evaluated
 *     relative to its own directory — or named by the explicit suite list that
 *     `scripts/eb3-security-run.mjs` executes. The include/exclude arrays are
 *     parsed from those files, never copied here, so a config edit cannot
 *     silently leave this catalog stale. A package test that no config matches
 *     is `UNCOLLECTED`, which is how the 7 `packages/domain/compatibility/test`
 *     suites were found (two levels below the package root, so neither the root
 *     include nor the package include reaches them).
 *   - node:test: `*.test.mjs|cjs|js` under `scripts/` and `tests/`, collected
 *     via the same workflow/manifest token reader M0's audit uses.
 *   - everything under `dev/agent-workflow/evidence/` is evidence, not a test:
 *     `EXCLUDED_WITH_REASON`, with the reason required from the registry.
 *
 * REFUSALS (exit 2)
 *   DUPLICATE_ID, CONTRACT_WITHOUT_TEST, CONTRACT_UNKNOWN_TEST,
 *   STALE_EXCLUDE, UNKNOWN_DRIVER, TEST_UNCOLLECTED, UNKNOWN_CLASSIFICATION,
 *   VITEST_CONFIG_UNREADABLE, INSTRUMENT_DRIVER_MISSING.
 *   A refusal is the point: at landing `TEST_UNCOLLECTED` is 91 suites (80
 *   node:test, 7 compatibility suites no config reaches, 4 POC suites only an
 *   authoring-only config includes), and it must not print as green just because
 *   the count is stable.
 *
 * USAGE
 *   node scripts/test-catalog.mjs                  # summary + findings
 *   node scripts/test-catalog.mjs --json           # the catalog artifact
 *   node scripts/test-catalog.mjs --diff           # two-way vs the CI lists
 *   node scripts/test-catalog.mjs --allow-uncollected   # report only, exit 0
 *   node scripts/test-catalog.mjs --max-uncollected 91  # ratchet: refuse GROWTH
 *   node scripts/test-catalog.mjs --self-test
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { gather as gatherCollection } from './test-collection-audit.mjs'

export const SCHEMA = 'test-catalog/1'
export const REGISTRY_FILE = 'dev/ci/test-contracts.json'
export const VITEST_CONFIG = 'vitest.config.ts'
/** Evidence scratch recorders are not product tests; the reason still has to be written down. */
export const EVIDENCE_PREFIX = 'dev/agent-workflow/evidence/'
/** What counts as a test file name. Used for node:test discovery AND contract refs. */
// The predicates moved to `scripts/test-suite-paths.mjs` in M6 (a leaf, because the collection
// audit cannot import this module: this module imports the audit). Re-exported here so every existing
// importer keeps working and there is still exactly ONE definition.
import { TEST_LIKE_RE, NODE_SUITE_RE, isTestLikePath, isNodeSuitePath } from './test-suite-paths.mjs'

export { TEST_LIKE_RE, NODE_SUITE_RE, isTestLikePath, isNodeSuitePath }

// ------------------------------------------------------------------ helpers

export function globToRe(glob) {
  let out = ''
  const g = String(glob)
  let i = 0
  while (i < g.length) {
    const ch = g[i]
    if (ch === '*' && g[i + 1] === '*') {
      const dirGlob = g[i + 2] === '/'
      out += dirGlob ? '(?:.*/)?' : '.*'
      i += dirGlob ? 3 : 2
      continue
    }
    if (ch === '*') { out += '[^/]*'; i += 1; continue }
    if (ch === '?') { out += '[^/]'; i += 1; continue }
    out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    i += 1
  }
  return new RegExp(`^${out}$`)
}

/** Parse the two glob arrays out of vitest.config.ts. Throws when it cannot. */
export function parseVitestConfig(text) {
  const pick = (key) => {
    const m = new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`).exec(text)
    if (!m) return []
    return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2])
  }
  const include = pick('include')
  const exclude = pick('exclude')
  if (include.length === 0) throw new Error('vitest.config.ts: no include[] found')
  return { include, exclude }
}

export function matchesAny(file, globs) {
  return globs.some((g) => globToRe(g).test(file))
}

/** Stable logical id: the contract id when the test is bound, else runner:path. */
export function idOf(entry) {
  if (entry.explicit_id) return entry.explicit_id
  const stem = entry.path.replace(/^\.\//, '').replace(/\.test\.(mjs|cjs|js|ts)$/, '')
  return `${entry.runner}:${stem}`
}

/** A ref is either a path string or `{path, id}` with a hand-assigned logical id. */
export function refOf(ref) {
  return typeof ref === 'string' ? { path: ref, id: null } : { path: ref?.path, id: ref?.id ?? null }
}

export function digestOf(entries) {
  const rows = entries
    .map((e) => [e.id, e.path, e.runner, e.kind, [...(e.contract_ids ?? [])].sort().join(',')])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return `sha256:${createHash('sha256').update(JSON.stringify(rows)).digest('hex')}`
}

export function loadRegistry(cwd) {
  const file = path.join(cwd, REGISTRY_FILE)
  if (!existsSync(file)) throw new Error(`${REGISTRY_FILE} is missing`)
  const reg = JSON.parse(readFileSync(file, 'utf8'))
  if (reg.schema !== 'test-contracts/1') throw new Error(`${REGISTRY_FILE}: schema must be test-contracts/1`)
  return reg
}

// ---------------------------------------------------------------- discovery

/**
 * Build catalog entries from a tracked-file list. Pure: no git, no fs.
 * `ciCollected` is the set of node:test paths the workflows/manifest name.
 */
export function buildEntries(files, { vitestCfg, configs = null, registry, ciCollected = new Set(), explicitlyCollected = new Set() } = {}) {
  const allEffective = configs ?? (vitestCfg ? [{ base: '', cfg: vitestCfg }] : [])
  const effectiveConfigs = allEffective.filter((c) => !c.authoringOnly)
  // A config's globs are relative to its directory — EXCEPT when they spell that
  // directory out (tests/poc-web-native-reuse/vitest.poc.config.ts includes
  // 'tests/poc-web-native-reuse/**/*.test.ts', i.e. repo-relative). Guessing one
  // convention made four real suites look uncollected, so each config declares
  // which one it uses, detected from its own include strings.
  const repoRelative = (base, cfg) => Boolean(base) && (cfg?.include ?? []).some((g) => g.startsWith(`${base}/`))
  const relOf = (base, file, cfg) => {
    if (!base) return file
    if (repoRelative(base, cfg)) return file
    return file.startsWith(`${base}/`) ? file.slice(base.length + 1) : null
  }
  // Collected means "a config include[] matches it", NOT "its name ends in .test.ts":
  // packages/client includes `test/**/*.client.spec.ts[x]`, and an extension-based
  // filter made 32 real client suites invisible to the catalog.
  const collectedByConfig = (file) => effectiveConfigs.some(({ base, cfg }) => {
    const rel = relOf(base, file, cfg)
    if (rel === null) return false
    return matchesAny(rel, cfg.include ?? []) && !matchesAny(rel, cfg.exclude ?? [])
  })
  const authoringConfigOf = (file) => allEffective.find((c) => c.authoringOnly && c.cfg && (() => {
    const rel = relOf(c.base, file, c.cfg)
    return rel !== null && matchesAny(rel, c.cfg.include ?? []) && !matchesAny(rel, c.cfg.exclude ?? [])
  })())
  const excludedByConfig = (file) => effectiveConfigs.some(({ base, cfg }) => {
    const rel = relOf(base, file, cfg)
    if (rel === null) return false
    return matchesAny(rel, cfg.exclude ?? [])
  })
  const entries = []
  const findings = []
  const contractOf = new Map()
  const explicitOf = new Map()
  for (const c of registry?.contracts ?? []) {
    for (const raw of c.test_refs ?? []) {
      const ref = refOf(raw)
      if (!ref.path) continue
      if (!contractOf.has(ref.path)) contractOf.set(ref.path, [])
      contractOf.get(ref.path).push(c.id)
      if (ref.id) explicitOf.set(ref.path, ref.id)
    }
  }
  const excludeOf = new Map((registry?.excludes ?? []).map((x) => [x.path, x]))

  for (const file of [...files].sort()) {
    if (excludeOf.has(file)) {
      const x = excludeOf.get(file)
      entries.push({ id: null, path: file, runner: 'none', kind: 'excluded', contract_ids: [], classification: 'EXCLUDED_WITH_REASON', reason: x.reason ?? '(none)' })
      continue
    }
    const testLike = isTestLikePath(file)
    const isNode = isNodeSuitePath(file)
    const vitestHit = collectedByConfig(file) || explicitlyCollected.has(file)
    if (!testLike && !isNode) continue

    if (vitestHit) {
      entries.push({ id: null, path: file, runner: 'vitest', kind: contractOf.has(file) ? 'contract' : 'unit', contract_ids: contractOf.get(file) ?? [], classification: 'DISCOVERED_AND_COLLECTED' })
      continue
    }
    const configExcluded = excludedByConfig(file)
    if (configExcluded) {
      entries.push({ id: null, path: file, runner: 'vitest', kind: contractOf.has(file) ? 'contract' : 'unit', contract_ids: contractOf.get(file) ?? [], classification: 'EXCLUDED_WITH_REASON', reason: 'vitest config exclude[]' })
      continue
    }
    if (!isNode) {
      const authoring = authoringConfigOf(file)
      entries.push({
        id: null, path: file, runner: 'vitest', kind: contractOf.has(file) ? 'contract' : 'unit', contract_ids: contractOf.get(file) ?? [],
        classification: 'UNCOLLECTED',
        reason: authoring ? `only ${authoring.file} includes it; that config is authoring-only (no lane passes --config)` : undefined,
      })
      continue
    }

    const underEvidence = file.startsWith(EVIDENCE_PREFIX)
    const classification = underEvidence ? 'EXCLUDED_WITH_REASON' : ciCollected.has(file) ? 'DISCOVERED_AND_COLLECTED' : 'UNCOLLECTED'
    entries.push({ id: null, path: file, runner: 'node', kind: contractOf.has(file) ? 'contract' : 'unit', contract_ids: contractOf.get(file) ?? [], classification, reason: underEvidence ? 'evidence scratch recorder' : undefined })
  }

  for (const entry of entries) {
    entry.explicit_id = explicitOf.get(entry.path) ?? null
    entry.id = idOf(entry)
  }

  for (const x of registry?.excludes ?? []) {
    if (!x.path) continue
    if (!files.has(x.path)) findings.push({ code: 'STALE_EXCLUDE', path: x.path, detail: 'the excluded path does not exist (renamed or deleted?)' })
    else if (!x.reason || !x.review) findings.push({ code: 'STALE_EXCLUDE', path: x.path, detail: 'exclude needs reason + review' })
  }

  for (const c of registry?.contracts ?? []) {
    const refs = (c.test_refs ?? []).map(refOf).filter((r) => r.path)
    if (refs.length === 0) findings.push({ code: 'CONTRACT_WITHOUT_TEST', contract: c.id, detail: 'a critical contract with no test_refs is an unbacked promise' })
    for (const ref of refs) {
      if (!files.has(ref.path)) findings.push({ code: 'CONTRACT_UNKNOWN_TEST', contract: c.id, path: ref.path, detail: 'test_ref does not exist (deleted or renamed?)' })
      else if (!TEST_LIKE_RE.test(ref.path)) findings.push({ code: 'CONTRACT_REF_NOT_A_TEST', contract: c.id, path: ref.path, detail: 'a contract bound to a non-test file is a coverage claim nobody runs' })
    }
  }

  const seen = new Map()
  for (const e of entries) {
    if (seen.has(e.id)) findings.push({ code: 'DUPLICATE_ID', path: e.path, other: seen.get(e.id), detail: e.id })
    else seen.set(e.id, e.path)
  }

  return { entries, findings }
}

export function classifyInstruments(registry, { exists = () => true } = {}) {
  const rows = []
  const findings = []
  for (const inst of registry?.instruments ?? []) {
    if (!inst.id || !inst.driver) {
      findings.push({ code: 'UNKNOWN_DRIVER', instrument: inst.id ?? '(none)', detail: 'instrument needs id + driver' })
      continue
    }
    if (!exists(inst.driver)) {
      findings.push({ code: 'INSTRUMENT_DRIVER_MISSING', instrument: inst.id, path: inst.driver })
      continue
    }
    rows.push({ id: inst.id, driver: inst.driver, contract_tests: inst.contract_tests ?? [] })
  }
  return { instruments: rows, findings }
}

/** Findings that depend on the catalog as a whole (after ids exist). */
export function auditCatalog(entries, { allowUncollected = false, maxUncollected = null } = {}) {
  const findings = []
  const uncollected = entries.filter((e) => e.classification === 'UNCOLLECTED')
  for (const e of uncollected) {
    if (!allowUncollected && maxUncollected === null) {
      findings.push({ code: 'TEST_UNCOLLECTED', path: e.path, runner: e.runner, detail: 'discovered but no lane collects it' })
    }
    if (e.runner === 'none' && e.classification !== 'EXCLUDED_WITH_REASON') {
      findings.push({ code: 'UNKNOWN_CLASSIFICATION', path: e.path })
    }
  }
  // A ratchet, not an amnesty: the known set may stay, growing it is a refusal.
  if (maxUncollected !== null && uncollected.length > maxUncollected) {
    findings.push({ code: 'UNCOLLECTED_GREW', detail: `${uncollected.length} > baseline ${maxUncollected}`, paths: uncollected.map((e) => e.path).slice(0, 10) })
  }
  return findings
}

/**
 * Two-way diff against what the CI artifacts still name explicitly.
 * `ciOnly` is the only refusal: a lane naming a file discovery cannot find means
 * the lane is built on a path form this catalog does not understand (a directory
 * or a glob argument) — that must be looked at, not silently tolerated.
 * `nodeUnnamed` is expected to equal the UNCOLLECTED node count; it is reported
 * as a number, not a list, because the list is already the refusal above it.
 */
export function diffAgainstCi(entries, ciTokenList) {
  const inCatalog = new Set(entries.map((e) => e.path))
  const inCi = new Set(ciTokenList)
  const node = entries.filter((e) => e.runner === 'node')
  return {
    ciNamed: inCi.size,
    catalogTotal: inCatalog.size,
    nodeUnnamed: node.filter((e) => !inCi.has(e.path)).length,
    nodeUnnamedUncollected: node.filter((e) => !inCi.has(e.path) && e.classification === 'UNCOLLECTED').length,
    vitestViaConfig: entries.filter((e) => e.runner === 'vitest' && e.classification === 'DISCOVERED_AND_COLLECTED' && !inCi.has(e.path)).length,
    ciOnly: [...inCi].filter((p) => !inCatalog.has(p)).sort(),
  }
}

// ---------------------------------------------------------------------- cli

function gitFiles(cwd) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd, maxBuffer: 64 * 1024 * 1024 })
  return out.toString('utf8').split('\0').filter(Boolean)
}

export const SECURITY_LIST = 'tests/checks/eb3-security-suites.txt'

/** Every vitest config in the repo, with the directory its globs are relative to. */
export function vitestConfigsOf(files, readConfig) {
  const out = []
  for (const file of [...files].sort()) {
    if (!/(^|\/)vitest(?:[.\w-]*)?\.config\.ts$/.test(file)) continue
    if (file.includes('node_modules/')) continue
    // Collection AUTHORITY is the config a lane actually runs. Vitest discovers a
    // file named exactly vitest.config.ts on its own; any other name only runs when
    // someone passes --config, and no workflow does (grep --config .github/workflows
    // → nothing). Reading every vitest*.config.ts made authoring-only configs into
    // collection authorities: vitest.scratch.config.ts includes **/*.scratch.test.ts
    // while the production config excludes it, so one "any include wins" rule could
    // report a scratch recorder as covered. They are still parsed — a suite they
    // include is reported UNCOLLECTED *with that reason*, not silently ignored.
    const name = path.posix.basename(file)
    const authoringOnly = name !== 'vitest.config.ts' || file.startsWith(EVIDENCE_PREFIX)
    const base = path.posix.dirname(file) === '.' ? '' : path.posix.dirname(file)
    try {
      out.push({ base, file, authoringOnly, cfg: readConfig(file) })
    } catch (e) {
      out.push({ base, file, authoringOnly, cfg: null, error: e?.message ?? String(e) })
    }
  }
  return out
}

export function explicitSuiteList(files, readList) {
  if (!files.has(SECURITY_LIST)) return new Set()
  return new Set(readList(SECURITY_LIST).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))
}

export function gather({ cwd = process.cwd() } = {}) {
  const files = new Set(gitFiles(cwd))
  const registry = loadRegistry(cwd)
  const readConfig = (f) => parseVitestConfig(readFileSync(path.join(cwd, f), 'utf8'))
  const allConfigs = vitestConfigsOf(files, readConfig)
  const broken = allConfigs.filter((c) => !c.cfg)
  const configs = allConfigs.filter((c) => c.cfg)
  const vitestCfg = configs.find((c) => c.base === '')?.cfg ?? null
  const explicitlyCollected = explicitSuiteList(files, (f) => readFileSync(path.join(cwd, f), 'utf8'))
  const collection = gatherCollection({ cwd })
  const ciCollected = new Set(collection.collected ?? [])
  const built = buildEntries(files, { vitestCfg, configs, registry, ciCollected, explicitlyCollected })
  for (const b of broken) built.findings.push({ code: 'VITEST_CONFIG_UNREADABLE', path: b.base || VITEST_CONFIG, detail: b.error })
  const inst = classifyInstruments(registry, { exists: (p) => files.has(p) })
  const findings = [...built.findings, ...inst.findings]
  const entries = built.entries
  return { cwd, files, registry, vitestCfg, configs, entries, instruments: inst.instruments, findings, ciCollected, explicitlyCollected }
}

export function summarize(entries, instruments) {
  const by = {}
  for (const e of entries) by[e.classification] = (by[e.classification] ?? 0) + 1
  const byRunner = {}
  for (const e of entries) byRunner[e.runner] = (byRunner[e.runner] ?? 0) + 1
  return { total: entries.length, byClassification: by, byRunner, instruments: instruments.length, digest: digestOf(entries) }
}

export function render({ entries, instruments, findings }, { allowUncollected = false } = {}) {
  const s = summarize(entries, instruments)
  const lines = []
  lines.push(`test-catalog (${SCHEMA}) — discovery + the node:test predicate the dispatcher resolves legs against`)
  lines.push(`  tests=${s.total} instruments=${s.instruments} digest=${s.digest}`)
  for (const [k, v] of Object.entries(s.byClassification).sort()) lines.push(`  ${k.padEnd(24)} ${v}`)
  lines.push(`  by runner: ${Object.entries(s.byRunner).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`)
  const blocking = findings.filter((f) => f.code !== 'TEST_UNCOLLECTED' || !allowUncollected)
  for (const f of findings.slice(0, 40)) lines.push(`  ${blocking.includes(f) ? 'REFUSED' : 'reported'} ${f.code} ${f.contract ?? f.instrument ?? f.path ?? ''} ${f.detail ?? ''}`.trimEnd())
  if (findings.length > 40) lines.push(`  … ${findings.length - 40} more`)
  lines.push(`DSH-TEST-CATALOG tests=${s.total} digest=${s.digest} refused=${blocking.length} findings=${findings.length}`)
  return { text: lines.join('\n'), blocking }
}

function main(argv) {
  const maxArg = argv.indexOf('--max-uncollected')
  const maxUncollected = maxArg >= 0 ? Number(argv[maxArg + 1]) : null
  if (maxArg >= 0 && !Number.isInteger(maxUncollected)) {
    console.error('REFUSED --max-uncollected needs an integer (a missing bound is never "no bound")')
    return 2
  }
  const opts = { json: argv.includes('--json'), diff: argv.includes('--diff'), allowUncollected: argv.includes('--allow-uncollected'), maxUncollected }
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help')) {
    console.log(readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 8).join('\n'))
    return 0
  }
  const state = gather({ cwd: process.cwd() })
  state.findings.push(...auditCatalog(state.entries, { allowUncollected: opts.allowUncollected, maxUncollected: opts.maxUncollected }))

  if (opts.json) {
    const artifact = {
      schema: SCHEMA,
      catalog_digest: digestOf(state.entries),
      tests: state.entries.filter((e) => e.classification !== 'EXCLUDED_WITH_REASON'),
      instruments: state.instruments,
    }
    console.log(JSON.stringify(artifact, null, 2))
    // Printing the artifact is not a verdict: --json used to exit 0 with a planted
    // CONTRACT_UNKNOWN_TEST and the 91 uncollected still in the file.
    const blocking = state.findings.filter((f) => f.code !== 'TEST_UNCOLLECTED' || (!opts.allowUncollected && opts.maxUncollected === null))
    for (const f of blocking) console.error(`REFUSED ${f.code} ${f.contract ?? f.instrument ?? f.path ?? ''} ${f.detail ?? ''}`.trimEnd())
    return blocking.length ? 2 : 0
  }

  const rendered = render(state, { allowUncollected: opts.allowUncollected })
  console.log(rendered.text)

  if (opts.diff) {
    const tokens = [...state.ciCollected, ...state.explicitlyCollected]
    const diff = diffAgainstCi(state.entries, tokens)
    console.log(`  two-way diff: ci_named=${diff.ciNamed} catalog=${diff.catalogTotal} node_unnamed=${diff.nodeUnnamed} (uncollected ${diff.nodeUnnamedUncollected}) vitest_via_config=${diff.vitestViaConfig} ci_only=${diff.ciOnly.length}`)
    for (const p of diff.ciOnly.slice(0, 20)) console.log(`    CI_ONLY ${p}  (a lane names it, discovery does not find it — refused)`)
    if (diff.ciOnly.length) rendered.blocking.push({ code: 'PLAN_REFERENCES_UNKNOWN_ID' })
  }
  return rendered.blocking.length ? 2 : 0
}

// ---------------------------------------------------------------- self-test

export function selfTest() {
  const cfg = { include: ['packages/*/test/**/*.test.ts'], exclude: ['**/*.scratch.test.ts'] }
  const registry = {
    contracts: [{ id: 'AUTH-01', test_refs: ['packages/domain/test/a4p7-v3.test.ts'] }],
    excludes: [{ path: 'dev/agent-workflow/evidence/x/y.test.ts', reason: 'evidence recorder', review: 'on recorder rewrite' }],
    instruments: [{ id: 'kit-a', driver: 'tests/kits/a/run.mjs', contract_tests: [] }],
  }
  const files = new Set([
    'packages/domain/test/a4p7-v3.test.ts',
    'packages/runtime/test/new.test.ts',
    'packages/runtime/test/z.scratch.test.ts',
    'scripts/a.test.mjs',
    'scripts/b.test.mjs',
    'dev/agent-workflow/evidence/x/y.test.ts',
    'tests/kits/a/run.mjs',
  ])
  const { entries } = buildEntries(files, { vitestCfg: cfg, registry, ciCollected: new Set(['scripts/a.test.mjs']) })
  const byPath = Object.fromEntries(entries.map((e) => [e.path, e]))
  const cases = []
  const expect = (name, ok, detail) => cases.push({ name, ok, detail })

  expect('vitest include is collected', byPath['packages/domain/test/a4p7-v3.test.ts'].classification === 'DISCOVERED_AND_COLLECTED')
  expect('unit vitest file is discovered', byPath['packages/runtime/test/new.test.ts']?.runner === 'vitest')
  expect('scratch recorder is excluded by config', byPath['packages/runtime/test/z.scratch.test.ts'].classification === 'EXCLUDED_WITH_REASON')
  expect('evidence recorder is excluded by registry', byPath['dev/agent-workflow/evidence/x/y.test.ts'].classification === 'EXCLUDED_WITH_REASON')
  expect('non-test files are not catalogued', !byPath['tests/kits/a/run.mjs'])
  expect('node suite in a lane is collected', byPath['scripts/a.test.mjs'].classification === 'DISCOVERED_AND_COLLECTED')
  expect('node suite in no lane is UNCOLLECTED', byPath['scripts/b.test.mjs'].classification === 'UNCOLLECTED')
  expect('uncollected is a refusal by default', auditCatalog(entries).some((f) => f.code === 'TEST_UNCOLLECTED'))
  expect('shadow mode turns it into a report', !auditCatalog(entries, { allowUncollected: true }).length)
  expect('contract binding is recorded', byPath['packages/domain/test/a4p7-v3.test.ts'].contract_ids[0] === 'AUTH-01')
  expect('a deleted contract test is refused', buildEntries(new Set(['packages/domain/test/other.test.ts']), { vitestCfg: cfg, registry }).findings.some((f) => f.code === 'CONTRACT_UNKNOWN_TEST'))
  expect('a contract with no test is refused', buildEntries(files, { vitestCfg: cfg, registry: { contracts: [{ id: 'X-01', test_refs: [] }] } }).findings.some((f) => f.code === 'CONTRACT_WITHOUT_TEST'))
  expect('an exclude without reason is refused', buildEntries(new Set(['dev/agent-workflow/evidence/x/y.test.ts']), { vitestCfg: cfg, registry: { excludes: [{ path: 'dev/agent-workflow/evidence/x/y.test.ts' }] } }).findings.some((f) => f.code === 'STALE_EXCLUDE'))
  expect('an exclude naming a missing file is refused', buildEntries(files, { vitestCfg: cfg, registry: { excludes: [{ path: 'gone/away.test.ts', reason: 'x', review: 'y' }] } }).findings.some((f) => f.code === 'STALE_EXCLUDE'))
  expect('duplicate logical ids are refused', (() => {
    const dup = { contracts: [{ id: 'A-01', test_refs: [{ path: 'packages/domain/test/a4p7-v3.test.ts', id: 'auth.binding' }, { path: 'packages/runtime/test/new.test.ts', id: 'auth.binding' }] }] }
    const r = buildEntries(files, { vitestCfg: cfg, registry: dup })
    return r.findings.some((f) => f.code === 'DUPLICATE_ID')
  })())
  expect('an explicit logical id survives a path move', (() => {
    const reg = { contracts: [{ id: 'A-01', test_refs: [{ path: 'packages/domain/test/a4p7-v3.test.ts', id: 'auth.binding' }] }] }
    const a = buildEntries(new Set(['packages/domain/test/a4p7-v3.test.ts']), { vitestCfg: cfg, registry: reg }).entries[0].id
    return a === 'auth.binding'
  })())
  expect('a missing instrument driver is refused', classifyInstruments({ instruments: [{ id: 'k', driver: 'nope.mjs' }] }, { exists: () => false }).findings.some((f) => f.code === 'INSTRUMENT_DRIVER_MISSING'))
  expect('glob semantics: ** crosses directories', matchesAny('packages/a/b/test/x.test.ts', ['packages/**/test/**/*.test.ts']))
  expect('glob semantics: * does not cross /', !matchesAny('packages/a/b/test/x.test.ts', ['packages/*/test/*.test.ts']))
  expect('digest is order independent', (() => {
    const a = [{ id: 'a', path: 'p', runner: 'node', kind: 'unit', contract_ids: [] }, { id: 'b', path: 'q', runner: 'node', kind: 'unit', contract_ids: [] }]
    return digestOf(a) === digestOf([...a].reverse())
  })())
  expect('config include[] is parsed', parseVitestConfig("test:{ include:['a/*.test.ts','b/**/*.test.ts'], exclude:['**/*.scratch.test.ts'] }").include.length === 2)
  expect('config without include[] throws', (() => { try { parseVitestConfig('test:{}'); return false } catch { return true } })())

  const failed = cases.filter((c) => !c.ok)
  for (const c of cases) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
  console.log(`DSH-TEST-CATALOG-SELFTEST ${failed.length ? 'FAIL' : 'PASS'} cases=${cases.length} failed=${failed.length}`)
  return failed.length ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
