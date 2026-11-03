#!/usr/bin/env node
/**
 * ci-local.mjs — the L0 inner loop for this repository.
 *
 * WHY THIS FILE EXISTS. The PR gate is the merge gate, and the census is the regression
 * gate; neither is an inner loop. A developer (or an agent) that pushes without a local
 * signal pays a full CI round for information that could have been had in under a minute.
 * This entry runs the checks that are (a) cheap, (b) local, and (c) already implemented —
 * `docs:probe`, `docs:sync --check`, the CI shape checker, the repo typecheck, and the
 * tests the change actually touches. It adds no gate of its own.
 *
 * WHAT IT DOES NOT DO. It does not build the synthetic merge tree, it does not run the
 * census, and it does not replace `ci-required`. A green here means "this change is worth
 * pushing", not "this change may merge".
 *
 * THE TEST SELECTION IS DELIBERATELY DUMB. It does not build a dependency graph: a changed
 * package source selects that package's test directory, a changed test file selects itself,
 * and anything whose blast radius cannot be named (root configs, shared test libraries,
 * non-CI scripts) returns `coverage=undetermined` with exit code 2. Guessing would be worse
 * than saying "I don't know": the one outcome this tool must never produce is "all affected
 * tests passed" when it did not know which tests were affected.
 *
 * TWO TEST RUNNERS EXIST HERE. `packages/**` is Vitest; `scripts/` and `tests/checks/` are
 * `node --test`. Dispatch reads the file's imports, not its extension, because an extension
 * is a convention while the import is the fact.
 *
 * @module scripts/ci-local
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEST_RE = /\.(test|spec)\.(ts|tsx|mjs|cjs|js)$/
const ROOT_CONFIGS = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'vitest.config.ts'])

/** Files whose change is graded by the CI's own static checkers, not by package tests. */
const CI_FAMILY = [/^\.github\//, /^dev\/ci\//, /^scripts\/eb3-[^/]*\.mjs$/, /^scripts\/ci-pr-gate\.mjs$/, /^scripts\/pr-settlement-gate\.mjs$/, /^tests\/checks\//, /^scripts\/doc-checks\.mjs$/]

export function isTestFile(p) {
  return TEST_RE.test(p)
}

export function isCiFamily(p) {
  return CI_FAMILY.some((re) => re.test(p)) && !isTestFile(p)
}

/**
 * The package a path belongs to, or null. Only `packages/<name>/...` counts.
 */
export function packageOf(p) {
  const m = /^packages\/([^/]+)\//.exec(p)
  return m === null ? null : m[1]
}

export function runnerFor(content, p = '') {
  // Anchored to a real import/require statement: a test that merely QUOTES the string
  // `from 'vitest'` (this file's own tests do) must not be classified as Vitest.
  if (/^\s*import\b[^\n]*['"]vitest['"]/m.test(content) || /^\s*const\b[^\n]*require\(['"]vitest['"]\)/m.test(content)) return 'vitest'
  if (/^\s*import\b[^\n]*['"]node:test['"]/m.test(content) || /^\s*const\b[^\n]*require\(['"]node:test['"]\)/m.test(content)) return 'node'
  // No import seen: fall back to the directory convention.
  return p.startsWith('packages/') ? 'vitest' : 'node'
}

/**
 * Split a change set into the things this tool knows how to act on.
 *
 * `undetermined` is not a failure — it is the honest answer for changes whose test blast
 * radius this tool refuses to invent.
 */
export function classify(paths) {
  const tests = new Set()
  const packages = new Set()
  const ci = new Set()
  const docsOnly = new Set()
  const undetermined = new Set()

  for (const raw of paths) {
    const p = raw.replace(/^\.\//, '')
    if (p === '') continue
    if (isTestFile(p)) { tests.add(p); continue }
    if (isCiFamily(p)) { ci.add(p); continue }
    const pkg = packageOf(p)
    if (pkg !== null) {
      // Any non-test file under a package selects that package's tests.
      packages.add(pkg)
      continue
    }
    if (ROOT_CONFIGS.has(p) || /^tsconfig[^/]*\.json$/.test(p)) { undetermined.add(p); continue }
    if (p.startsWith('tests/')) { undetermined.add(p); continue } // shared kits/fixtures: blast radius unnamed
    if (p.startsWith('scripts/')) { undetermined.add(p); continue }
    // Everything else (docs, evidence, plans, graph, logs) selects no test runner.
    docsOnly.add(p)
  }

  return {
    tests: [...tests].sort(),
    packages: [...packages].sort(),
    ci: [...ci].sort(),
    docsOnly: [...docsOnly].sort(),
    undetermined: [...undetermined].sort(),
  }
}

/**
 * Turn a classification into an execution plan. Pure: no filesystem, no spawning — the
 * unit tests pin this function.
 */
export function buildPlan(classified, { hasTypecheck = true } = {}) {
  const vitest = new Set()
  const nodeTest = new Set()

  for (const f of classified.tests) {
    const content = readSafe(f)
    if (runnerFor(content, f) === 'vitest') vitest.add(f)
    else nodeTest.add(f)
  }
  for (const pkg of classified.packages) {
    const dir = join('packages', pkg, 'test')
    if (existsSync(join(ROOT, dir))) vitest.add(`${dir}/**/*.test.{ts,tsx}`)
  }

  const coverage = classified.undetermined.length > 0 ? 'undetermined' : 'determined'
  return {
    vitest: [...vitest].sort(),
    nodeTest: [...nodeTest].sort(),
    ciFamily: classified.ci,
    docsOnly: classified.docsOnly,
    undetermined: classified.undetermined,
    coverage,
    typecheck: hasTypecheck,
  }
}

/** Paths changed against `base`, including uncommitted work. */
export function changedPaths(base) {
  const mergeBase = git(['merge-base', base, 'HEAD'])
  if (mergeBase === null) throw new Error(`ci-local: cannot resolve a merge base with ${base}`)
  const committed = git(['diff', '--name-only', mergeBase, 'HEAD']) ?? ''
  const dirty = git(['status', '--porcelain']) ?? ''
  const paths = new Set(committed.split('\n').filter(Boolean))
  for (const line of dirty.split('\n')) {
    if (line.trim() === '') continue
    // porcelain v1: XY <path> (renames show `old -> new`; take the new side)
    const rest = line.slice(3)
    const arrow = rest.indexOf(' -> ')
    paths.add((arrow === -1 ? rest : rest.slice(arrow + 4)).replace(/^"|"$/g, ''))
  }
  return [...paths].sort()
}

function readSafe(p) {
  try { return readFileSync(join(ROOT, p), 'utf8') } catch { return '' }
}

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  if (r.status !== 0) return null
  return r.stdout.trimEnd()
}

function step(name, command, args, opts = {}) {
  const started = Date.now()
  process.stdout.write(`\n▶ ${name}\n`)
  const r = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...opts })
  const wallMs = Date.now() - started
  const ok = r.status === 0
  process.stdout.write(`${ok ? '✔' : '✘'} ${name} (${(wallMs / 1000).toFixed(1)}s)\n`)
  return { name, ok, wallMs, status: r.status }
}

function parseArgs(argv) {
  const opts = { base: 'origin/master', json: false, noTypecheck: false, noTests: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--base') { opts.base = argv[++i] }
    else if (a === '--json') opts.json = true
    else if (a === '--no-typecheck') opts.noTypecheck = true
    else if (a === '--no-tests') opts.noTests = true
    else if (a === '--help' || a === '-h') opts.help = true
    else { process.stderr.write(`ci-local: unknown argument ${a}\n`); process.exit(2) }
  }
  return opts
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write(
      'usage: node scripts/ci-local.mjs [--base <ref>] [--json] [--no-typecheck] [--no-tests]\n' +
      '  L0 inner loop: docs probes, CI shape, typecheck, and the tests this change touches.\n' +
      '  exit 0 = selected checks passed; 1 = a selected check failed; 2 = test coverage undetermined.\n',
    )
    return 0
  }

  const paths = changedPaths(opts.base)
  const classified = classify(paths)
  const plan = buildPlan(classified, { hasTypecheck: !opts.noTypecheck })
  const results = []

  results.push(step('docs:probe', process.execPath, ['scripts/docs-probe.mjs', '--base', opts.base]))
  results.push(step('docs:sync --check', process.execPath, ['scripts/docs-sync.mjs', '--check']))
  results.push(step('ci shape (eb3-ci-required)', process.execPath, ['scripts/eb3-ci-required.mjs']))

  if (plan.ciFamily.length > 0) {
    results.push(step('ci negative controls', process.execPath, ['scripts/eb3-ci-negative-controls.mjs']))
  }
  if (plan.typecheck) {
    results.push(step('pnpm typecheck', 'pnpm', ['run', 'typecheck']))
  }

  if (!opts.noTests) {
    if (plan.vitest.length > 0) {
      results.push(step('vitest (selected)', 'pnpm', ['exec', 'vitest', 'run', ...plan.vitest]))
    }
    if (plan.nodeTest.length > 0) {
      results.push(step('node --test (selected)', process.execPath, ['--test', ...plan.nodeTest]))
    }
  }

  const failed = results.filter((r) => !r.ok)
  const verdict = failed.length > 0 ? 'fail' : plan.coverage === 'undetermined' ? 'undetermined' : 'pass'
  const wall = results.reduce((n, r) => n + r.wallMs, 0) / 1000
  const token = `DSH-CI-LOCAL verdict=${verdict} steps=${results.length} failed=${failed.length} ` +
    `coverage=${plan.coverage} files=${plan.vitest.length + plan.nodeTest.length} wall=${wall.toFixed(1)}s`
  process.stdout.write(`\n${token}\n`)

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ verdict, coverage: plan.coverage, plan, results, token }, null, 2)}\n`)
  }
  if (plan.coverage === 'undetermined' && failed.length === 0) {
    process.stdout.write(
      'ci-local: the selected checks passed, but this change\'s test blast radius is unnamed:\n' +
      plan.undetermined.map((p) => `  - ${p}`).join('\n') + '\n' +
      'ci-local: that is exit 2 on purpose. Push and let L1/L2 cover it.\n',
    )
  }
  if (verdict === 'pass') return 0
  if (verdict === 'undetermined') return 2
  return 1
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main())
}
