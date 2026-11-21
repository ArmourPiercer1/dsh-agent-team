#!/usr/bin/env node
/**
 * ute-cut-closure.test.mjs — the closure check's own controls.
 *
 * The closure exists because a deletion inventory is not a dependency closure. Its failure
 * modes are specific: matching basenames instead of resolving specifiers (thousands of false
 * hits, then the check gets ignored), and missing the dynamic `new URL(..., import.meta.url)`
 * form that the first review found in a5sf-realm-row.mjs. Each arm below pins one of them.
 *
 * Run: node --test scripts/ute-cut-closure.test.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DISPOSITIONS,
  TEST_PREFIXES,
  deriveClosure,
  distCounterpartsOf,
  resolveSpecifier,
  specifiersOf,
} from './ute-cut-closure.mjs'

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
  // The real file, the real form: five shadows are reached this way, so a closure check that
  // only understood `import` would report the realm row as clean.
  const specs = specifiersOf("const X = new URL('./confined-fs-tool.mjs', import.meta.url).href")
  assert.deepEqual(specs, ['./confined-fs-tool.mjs'])
})

test('CLOSURE-3 — specifiers resolve against the referrer, with extension substitution', () => {
  assert.equal(resolveSpecifier('packages/tools/src/index.ts', './tokens'), 'packages/tools/src/tokens.ts')
  assert.equal(
    resolveSpecifier('packages/runtime/src/plugin/live/agent-bindings.mjs', './team-tool-plane.mjs'),
    'packages/runtime/src/plugin/live/team-tool-plane.mjs',
  )
  // A bare package specifier is not a file reference, and must not be resolved at all.
  assert.equal(resolveSpecifier('packages/tools/src/index.ts', '@deepseek-ai/dsh-tools'), null)
})

test('CLOSURE-4 — basename coincidence is NOT a reference (the noise control)', () => {
  // `./index.ts` from a directory that has no index.ts resolves to null; it must never be
  // matched against some other module's index.ts, which is what a basename scan does.
  assert.equal(resolveSpecifier('scripts/ute-carbuncle.mjs', './index.ts'), null)
  const findings = deriveClosure().findings
  assert.ok(findings.length > 0, 'the real tree has references into the delete set')
  // and every reported target really is a file that exists today
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
  // a dist path is never its own source
  assert.deepEqual(distCounterpartsOf('packages/runtime/dist/packages/runtime/x.js'), [])
})

test('CLOSURE-6 — the three dynamic shadows that killed the first inventory are actually reported', () => {
  const findings = deriveClosure().findings
  const fromRealmRow = findings.filter((f) => f.referrer === 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')
  const targets = new Set(fromRealmRow.map((f) => f.target))
  for (const shadow of ['confined-fs-tool.mjs', 'confined-bash-tool.mjs', 'native-bash-tool.mjs']) {
    assert.ok(
      [...targets].some((t) => t.endsWith(shadow)),
      `a5sf-realm-row must be reported as reaching ${shadow}; got ${JSON.stringify([...targets])}`,
    )
  }
})

test('CLOSURE-7 — every surviving production referrer has a declared disposition', () => {
  const findings = deriveClosure().findings
  const production = [...new Set(findings.filter((f) => f.class === 'production').map((f) => f.referrer))]
  assert.ok(production.length > 0, 'the tree has production references; the check must see them')
  for (const p of production) {
    const d = DISPOSITIONS[p]
    assert.ok(d !== undefined, `${p} has no disposition`)
    assert.ok(['rewire', 'replace', 'delete-with-group'].includes(d.disposition), `${p}: ${d.disposition}`)
    assert.ok(typeof d.note === 'string' && d.note.length > 40, `${p}: a disposition needs a real note`)
  }
})

test('CLOSURE-8 — the test allow-list carries a reason for every prefix', () => {
  for (const entry of TEST_PREFIXES) {
    assert.equal(entry.length, 2)
    assert.ok(entry[1].length > 20, `${entry[0]} needs a reason`)
  }
})
