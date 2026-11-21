#!/usr/bin/env node
/**
 * ute-cut-closure.test.mjs — the closure check's own controls.
 *
 * The closure exists because a deletion inventory is not a dependency closure. Its failure
 * modes are specific, and each arm below pins one:
 *
 *   - matching basenames instead of resolving specifiers (thousands of false hits, and then
 *     the check gets ignored);
 *   - missing the dynamic `new URL(..., import.meta.url)` form;
 *   - resolving with `existsSync`, which makes a dangling reference DISAPPEAR precisely when
 *     its target is deleted — the check then goes green *because* the cut worked;
 *   - exempting whole test directories instead of registering named files.
 *
 * The third and fourth are why CLOSURE-9 builds a real git repository, deletes the file, and
 * requires a RED, and why CLOSURE-8 refuses a directory as an exemption.
 *
 * Run: node --test scripts/ute-cut-closure.test.mjs
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DISPOSITIONS,
  deriveClosure,
  distCounterpartsOf,
  duplicateDeclarants,
  loadExemptions,
  resolveCandidates,
  resolveSpecifier,
  specifiersOf,
} from './ute-cut-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const CHECK = join(REPO, 'scripts/ute-cut-closure.mjs')

test('CLOSURE-1 — every reference form is seen: static, dynamic import, require, new URL', () => {
  const text = `
    import { a } from './a.ts'
    export { b } from './b.mjs'
    const c = await import('./c.mjs')
    const d = require('./d.mjs')
    const e = new URL('./e.mjs', import.meta.url)
  `
  const specs = specifiersOf(text)
  for (const want of ['./a.ts', './b.mjs', './c.mjs', './d.mjs', './e.mjs']) {
    assert.ok(specs.includes(want), `missing ${want} in ${JSON.stringify(specs)}`)
  }
})

test('CLOSURE-2 — the dynamic URL form is the one a static scanner misses (a5sf-realm-row)', () => {
  const specs = specifiersOf("const X = new URL('./confined-fs-tool.mjs', import.meta.url).href")
  assert.deepEqual(specs, ['./confined-fs-tool.mjs'])
})

test('CLOSURE-3 — candidates are computed TEXTUALLY, so a deleted target still has a name', () => {
  // Review round 2, P0: resolution must not depend on the file existing. `./gone` from a
  // package directory yields every extension the referrer could have meant, whether or not
  // any of them is on disk today.
  const got = resolveCandidates('packages/tools/src/index.ts', './gone')
  assert.ok(got.includes('packages/tools/src/gone.ts'), JSON.stringify(got))
  assert.ok(got.includes('packages/tools/src/gone.mjs'))
  assert.ok(got.includes('packages/tools/src/gone/index.ts'))
  assert.deepEqual(got.filter((p) => p.includes('dist')), [], 'the source form never resolves into dist')
  // a bare package specifier is never a file reference
  assert.deepEqual(resolveCandidates('packages/tools/src/index.ts', '@deepseek-ai/dsh-tools'), [])
})

test('CLOSURE-4 — basename coincidence is NOT a reference (the noise control)', () => {
  assert.equal(resolveSpecifier('scripts/ute-carbuncle.mjs', './index.ts'), null)
  const findings = deriveClosure().findings
  assert.ok(findings.length > 0, 'the real tree has references into the delete set')
  for (const f of findings.slice(0, 25)) {
    assert.ok(f.target.includes('/'), `target must be a resolved path, got ${f.target}`)
  }
})

test('CLOSURE-5 — dist parity: a deleted source names exactly the artifacts that must go with it', () => {
  const got = distCounterpartsOf('packages/runtime/src/plugin/live/team-tool-plane.mjs')
  assert.equal(got.length, 4)
  for (const g of got) {
    assert.ok(g.startsWith('packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.'), g)
  }
  assert.deepEqual(distCounterpartsOf('packages/runtime/dist/packages/runtime/x.js'), [])
})

test('CLOSURE-6 — the dynamic shadows that killed the first inventory are actually reported', () => {
  const targets = new Set(
    deriveClosure().findings
      .filter((f) => f.referrer === 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')
      .map((f) => f.target),
  )
  for (const shadow of ['confined-fs-tool.mjs', 'confined-bash-tool.mjs', 'native-bash-tool.mjs']) {
    assert.ok([...targets].some((t) => t.endsWith(shadow)), `realm row must reach ${shadow}; got ${JSON.stringify([...targets])}`)
  }
})

test('CLOSURE-7 — every surviving production referrer has a declared disposition', () => {
  const production = [...new Set(deriveClosure().findings.filter((f) => f.class === 'production').map((f) => f.referrer))]
  assert.ok(production.length > 0, 'the tree has production references; the check must see them')
  for (const p of production) {
    const d = DISPOSITIONS[p]
    assert.ok(d !== undefined, `${p} has no disposition`)
    assert.ok(['rewire', 'replace', 'delete-with-group'].includes(d.disposition), `${p}: ${d.disposition}`)
    assert.ok(typeof d.note === 'string' && d.note.length > 40, `${p}: a disposition needs a real note`)
  }
})

test('CLOSURE-8 — exemptions are per FILE, with a subject and a reason; no directory is exempt', () => {
  const m = loadExemptions()
  assert.ok(m.size > 0)
  for (const [path, e] of m) {
    assert.ok(!path.endsWith('/'), `${path} is a directory — a directory is not a reason`)
    assert.ok(['retired-module', 'replaced-entry', 'evidence-record'].includes(e.subject), `${path}: subject ${e.subject}`)
    assert.ok(typeof e.reason === 'string' && e.reason.length > 40, `${path}: needs a real reason`)
  }
  // the exemption set is exactly the referrer set: no stale entries, nothing unreviewed
  const referrers = new Set(deriveClosure().findings.filter((f) => f.class !== 'production').map((f) => f.referrer))
  for (const r of referrers) assert.ok(m.has(r), `${r} refers to the delete set but is not registered`)
  for (const p of m.keys()) assert.ok(referrers.has(p), `${p} is registered but no longer refers to anything`)
})

/** A throwaway git repo that looks enough like this one to run the real check against. */
function miniRepo () {
  const dir = mkdtempSync(join(tmpdir(), 'ute-closure-'))
  const sh = (args, opts = {}) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe', ...opts })
  const write = (p, body) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), body)
  }
  sh(['init', '-q', '-b', 'main'])
  sh(['config', 'user.email', 't@example.com'])
  sh(['config', 'user.name', 't'])
  write('packages/x/src/keep.ts', "import { g } from './gone.ts'\nexport const k = g\n")
  write('packages/x/src/gone.ts', 'export const g = 1\n')
  write('packages/x/src/gone2.ts', 'export const h = 2\n')
  write('dev/agent-workflow/ledgers/ute-p0-assets.json', JSON.stringify({
    modules: [{
      id: 'gone', title: 'gone', kind: 'old-execution', roots: ['packages/x/src'],
      files: ['packages/x/src/gone.ts', 'packages/x/src/gone2.ts'], names: ['read'],
      bucket: 'B', verdict: 'delete', wave: 1, deleteWith: 'x', lines: 2, note: 'n',
    }],
    totals: { modules: 1, files: 2, lines: 2, deleteFiles: 2, replaceFiles: 0, keepFiles: 0, wave1Files: 2, wave2Files: 0, wave3Files: 0 },
  }, null, 2))
  write('dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json', JSON.stringify({
    schema: 'ute-p0-assets-snapshot/1',
    modules: [{ id: 'gone', verdict: 'delete', bucket: 'B', wave: 1, files: ['packages/x/src/gone.ts', 'packages/x/src/gone2.ts'], lines: 2 }],
  }, null, 2))
  write('dev/agent-workflow/ledgers/ute-cut-closure.allow.json', JSON.stringify({ schema: 'ute-cut-closure-allow/1', entries: [] }, null, 2))
  write('dev/agent-workflow/ledgers/ute-cut-closure.dispositions.json', JSON.stringify({
    schema: 'ute-cut-closure-dispositions/1',
    entries: { 'packages/x/src/keep.ts': { disposition: 'rewire', note: 'Mini-repo fixture: the keep file is re-pointed at the replacement module when the retired one goes.' } },
  }, null, 2))
  sh(['add', '-A'])
  sh(['commit', '-qm', 'init'])
  return { dir, sh }
}

const runCheck = (dir) => {
  try {
    const out = execFileSync(process.execPath, [CHECK, '--check', '--root', dir], { encoding: 'utf8', stdio: 'pipe' })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

test('CLOSURE-9 — THE POST-DELETION CONTROL: delete the target, keep the reference, the check must RED', () => {
  const { dir, sh } = miniRepo()
  try {
    // Before the cut the reference exists and so does its target, so the closure is clean:
    // `pending` is a legitimate state and the four zeros do not apply yet.
    execFileSync(process.execPath, [CHECK, '--write', '--root', dir], { stdio: 'pipe' })
    const before = runCheck(dir)
    assert.equal(before.code, 0, `a pending cut with resolvable targets should pass:\n${before.out}`)

    // The cut, half-done: one of two deletable files gone. A half-cut realm declares names
    // twice, so this is a named RED even though the surviving reference still resolves.
    sh(['rm', '-q', 'packages/x/src/gone2.ts'])
    const partial = runCheck(dir)
    assert.notEqual(partial.code, 0, 'a half-cut tree MUST fail')
    assert.match(partial.out, /UTE_CLOSURE_PARTIAL/, partial.out)

    // The cut, complete: every retired source gone while `keep.ts` still imports one of them.
    // This is the exact situation an `existsSync` resolver reports as NOTHING AT ALL.
    sh(['rm', '-q', 'packages/x/src/gone.ts'])
    const after = runCheck(dir)
    assert.notEqual(after.code, 0, 'a dangling production reference after deletion MUST fail the check')
    assert.match(after.out, /UTE_CLOSURE_PRODUCTION_REF/, after.out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLOSURE-10 — a dist artifact left behind for a deleted source is a RED at cut time', () => {
  const { dir, sh } = miniRepo()
  try {
    sh(['rm', '-q', 'packages/x/src/gone.ts', 'packages/x/src/gone2.ts'])
    // A committed build artifact for a source that no longer exists.
    mkdirSync(join(dir, 'packages/x/dist/packages/x/src'), { recursive: true })
    writeFileSync(join(dir, 'packages/x/dist/packages/x/src/gone.js'), 'export const g = 1\n')
    sh(['add', '-A']); sh(['commit', '-qm', 'dist residual'])
    const after = runCheck(dir)
    assert.notEqual(after.code, 0)
    assert.match(after.out, /UTE_CLOSURE_DIST_ARTIFACT/, after.out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLOSURE-11 — an unregistered test referrer is a finding, not a directory-wide pass', () => {
  const { dir } = miniRepo()
  try {
    execFileSync(process.execPath, [CHECK, '--write', '--root', dir], { stdio: 'pipe' })
    mkdirSync(join(dir, 'tests/worlds'), { recursive: true })
    writeFileSync(join(dir, 'tests/worlds/x.test.mjs'), "import '../../packages/x/src/gone.ts'\n")
    execFileSync('git', ['add', '-A'], { cwd: dir })
    execFileSync('git', ['commit', '-qm', 'unregistered'], { cwd: dir })
    const after = runCheck(dir)
    assert.notEqual(after.code, 0)
    // the report is stale now too, but the exemption finding must be there
    assert.match(after.out, /UTE_CLOSURE_(UNREGISTERED_EXEMPTION|STALE)/, after.out)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLOSURE-12 — duplicate declarants count production files only', () => {
  // Test fixtures and evidence quote booked names inside expectations; counting them would
  // leave the arm permanently red and therefore meaningless. Production declares none of the
  // retired names today (every declarant is inside the delete set), so this is empty — and it
  // stays meaningful, because a NEW production declarant of a booked name shows up as two.
  assert.deepEqual(duplicateDeclarants(REPO, ['read', 'write', 'bash']), [])
})

test('CLOSURE-13 — the committed report and the tree agree', () => {
  const report = JSON.parse(readFileSync(join(REPO, 'dev/agent-workflow/ledgers/ute-cut-closure.json'), 'utf8'))
  const fresh = deriveClosure()
  const summed = report.groups.reduce((n, g) => n + g.count, 0)
  assert.equal(summed, fresh.findings.length, 'the committed report must account for every reference')
  assert.equal(report.deletedCount, fresh.deletedCount)
  assert.equal(report.dispositions === undefined ? 0 : Object.keys(report.dispositions).length, Object.keys(DISPOSITIONS).length)
})
