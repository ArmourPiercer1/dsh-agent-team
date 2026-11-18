// TINF M6 mutation controls: apply each deletion a reviewer could make, run the suite that claims to
// cover it, restore the exact bytes. A mutation the suite does NOT kill is a hole in the claim.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

// Run from the repo root; paths below are repo-relative. Restores the exact bytes it mutates.

const MUTATIONS = [
  {
    id: 'evidence-digest-not-compared',
    why: 'the evidence reference no longer verifies the bytes it attests',
    file: 'scripts/census-aggregate.mjs',
    from: 'if (actual !== token) {',
    to: 'if (false) {',
    suite: ['scripts/census-cutover.test.mjs'],
  },
  {
    id: 'empty-argv-allowed',
    why: 'a leg with no population would make `node --test` run the whole repository',
    file: 'scripts/dispatch-tests.mjs',
    from: 'if (problems.length === 0 && list.length === 0) {',
    to: 'if (false) {',
    suite: ['scripts/test-catalog.test.mjs'],
  },
  {
    id: 'workflow-list-restored',
    why: 'the twin file list comes back into the workflow',
    file: '.github/workflows/ci-integration.yml',
    from: '        run: node scripts/dispatch-tests.mjs --run --leg tinf-m0-baseline',
    to: '        run: node scripts/dispatch-tests.mjs --run --leg tinf-m0-baseline\n        # node --test scripts/tinf-m0.test.mjs\n        run: node --test scripts/tinf-m0.test.mjs',
    suite: ['scripts/test-catalog.test.mjs'],
  },
  {
    id: 'node-suite-predicate-loosened',
    why: 'any tracked file would count as a node:test suite',
    file: 'scripts/test-suite-paths.mjs',
    from: 'export const NODE_SUITE_RE = /\\.(?:test|spec)\\.(?:mjs|cjs|js)$/',
    to: 'export const NODE_SUITE_RE = /.*/',
    suite: ['scripts/test-catalog.test.mjs'],
  },
  {
    id: 'ratchet-removed',
    why: 'the uncollected count stops being gated (M1 ratchet silently retired)',
    file: '.github/workflows/ci-integration.yml',
    from: '          node scripts/test-catalog.mjs --max-uncollected 91\n',
    to: '',
    suite: ['scripts/test-catalog.test.mjs'],
  },
  {
    id: 'recorded-drop-verification-reverted',
    why: '--verify-plan refuses the plans the planner itself blessed',
    file: 'scripts/census-plan.mjs',
    from: "if (!roots.ok && roots.code === 'ROOT_DROPPED_BY_EXCLUDE') {",
    to: 'if (false) {',
    suite: ['scripts/census-plan.test.mjs'],
  },
  {
    id: 'dispatch-leg-cmd-loses-run',
    why: 'the step prints an argv and gates nothing',
    file: 'dev/ci/eb3-ci-manifest.json',
    from: '"--run",\n            "--leg",\n            "tinf-m0-baseline"',
    to: '"--leg",\n            "tinf-m0-baseline"',
    suite: null, // graded by the checker itself, not a node:test suite
  },
]

let killed = 0
const rows = []
for (const m of MUTATIONS) {
  const original = readFileSync(m.file, 'utf8')
  const mutated = original.replace(m.from, m.to)
  if (mutated === original) throw new Error(`${m.id}: mutation did not apply (anchor moved)`)
  writeFileSync(m.file, mutated)
  try {
    const r = m.suite === null
      ? spawnSync(process.execPath, ['scripts/eb3-ci-required.mjs'], { encoding: 'utf8' })
      : spawnSync(process.execPath, ['--test', ...m.suite], { encoding: 'utf8' })
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
    const red = r.status !== 0
    if (red) killed += 1
    const failCount = /ℹ fail (\d+)/.exec(out)?.[1] ?? (/findings=(\d+)/.exec(out)?.[1] ?? '?')
    const code = /findings=(\d+)/.exec(out) ? [...new Set([...out.matchAll(/CI_[A-Z_]+/g)].map((x) => x[0]))].join(',') : ''
    rows.push({ id: m.id, red, exit: r.status, failCount, code, why: m.why })
  } finally {
    writeFileSync(m.file, original)
  }
}

for (const r of rows) {
  console.log(`  ${r.red ? 'KILLED  ' : 'SURVIVED'} ${r.id} exit=${String(r.exit)} red-count=${r.failCount}${r.code ? ` codes=${r.code}` : ''}`)
}
console.log(`DSH-M6-MUTATION kill=${killed}/${rows.length} rate=${((killed / rows.length) * 100).toFixed(0)}%`)
