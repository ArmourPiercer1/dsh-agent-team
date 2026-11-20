/**
 * native-fs-binding.test.mjs — UTE-1 acceptance suite for the product-side
 * native FS binding.
 *
 * WHAT THIS SUITE OWNS
 *   1. the product module's own contract, on the shipped module (host-free arms)
 *   2. the MUTATION TRANSCRIPT: every negative control is RED without the
 *      behaviour and GREEN with it (recorded line by line)
 *   3. the REAL Team-Agent assembly on the pinned rc.5 host: a real session runs
 *      a confined write and is refused an out-of-lane write through the host's
 *      own executor, mounted by `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`
 *   4. SCOPE LIFECYCLE: mount → in-scope I/O → dispose → named refusal, plus
 *      double-dispose, use-after-dispose, overlapping scopes and provider swap
 *   5. the assembly-path control: without the product module's provider class the
 *      SAME out-of-lane call falls back and succeeds (so the deny arm measured
 *      the binding, not something else)
 *   6. GOLDEN PARITY: the product module reproduces the 10 old-path golden
 *      vectors of the G1-S1 prototype, unchanged
 *   7. DISCLOSURE: the two retirement-blocking semantic differences are still
 *      declared (the suite fails if they are quietly dropped)
 *
 * HOST REQUIREMENT. This suite needs `tests/deepseek-harness-next` (0.2.2-rc.5,
 * `tests/paths.mjs#NEXT_HOST`). A missing/drifted tree is a module-load THROW
 * (`NextHostMissingError`), never a skip — the CI leg that runs this file also
 * provisions the tree (`scripts/provision-next-host.mjs --materialize`,
 * `--assets`), so a missing tree is a red lane.
 *
 * @module tests/ute1-fs/native-fs-binding
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { NEXT_HOST } from '../paths.mjs'
import { assertNextHostTree } from '../next-host/host-next-lib.mjs'
import { semanticDifferenceLines } from '../ute-g1-fs/lib/semantic-differences.mjs'
import * as nativeFsBinding from '../../packages/tools/src/native-fs-binding.ts'
import { runAllArms } from './lib/arms.mjs'
import { makeAssembledMemberWorld } from './lib/assembly.mjs'
import { runProductGolden } from './lib/golden-run.mjs'
import { runMutationTranscript } from './mutation-transcript.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const MODULE_SOURCE = join(REPO_ROOT, 'packages', 'tools', 'src', 'native-fs-binding.ts')
const MODULE_REL = 'packages/tools/src/native-fs-binding.ts'
/** The pin this suite measures against (single source: tests/paths.mjs). */
const GENERATION = NEXT_HOST.version

/** Recursively collect source files under one directory. */
function walkSources(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkSources(full, out)
    else if (/\.(?:ts|mjs|js)$/.test(entry.name)) out.push(full)
  }
  return out
}

test('product module: additive, dependency-free, and imported by no shipped assembly', async () => {
  const source = readFileSync(MODULE_SOURCE, 'utf8')
  assert.match(source, /export (?:async )?function mountNativeFsBinding/, 'the public mount entry must exist')
  assert.match(source, /export function createNativeFsBindingScope/, 'the scope entry must exist')
  // Dependency-free: no import/require at all, so no host dependency is added to
  // the `tools` package and the mutation copies load standalone.
  const importLines = source.split('\n').filter((line) => /^\s*(?:import|export\s+[^t].*from)\s/.test(line))
  assert.deepEqual(importLines, [], `the module must have no imports/requires, found: ${importLines.join(' | ')}`)
  assert.ok(!source.includes('deepseek-harness-test-use'), 'the module must not name the legacy host tree')
  // Exactly one shipped file may reference it: the package barrel. Everything
  // else would be production wiring, which UTE-1 explicitly does not add.
  const referrers = []
  for (const pkg of readdirSync(join(REPO_ROOT, 'packages'), { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue
    for (const file of walkSources(join(REPO_ROOT, 'packages', pkg.name, 'src'))) {
      if (readFileSync(file, 'utf8').includes('native-fs-binding')) referrers.push(relative(REPO_ROOT, file))
    }
  }
  assert.deepEqual(
    referrers.sort(),
    ['packages/tools/src/index.ts', MODULE_REL].sort(),
    'only the package barrel may reference the module (additive export, no wiring)',
  )
  // The barrel export is what makes the module part of the package's public API.
  const barrel = readFileSync(join(REPO_ROOT, 'packages', 'tools', 'src', 'index.ts'), 'utf8')
  assert.match(barrel, /from '\.\/native-fs-binding\.js'/, 'the barrel must re-export the module')
})

test('product module: names no ambient global the PRODUCTION compile face does not provide', () => {
  // WHY THIS TEST EXISTS (hosted run after 2ec811f6f, "Build this repo" red).
  // `tsc -p packages/tools/tsconfig.json --noEmit` includes `test` + vitest.config.ts,
  // whose type graph pulls the DOM lib in, so ambient globals like `AbortSignal`
  // compile there. The census builds with `tsconfig.build.json`, which includes only
  // `src` and `lib: ["ES2022"]` — no DOM, no ambient node types — so the same code is
  // TS2304 there. The module must therefore declare its own structural types. This
  // assertion is the cheap, host-free half; the real check is the build config itself,
  // which CI runs and `evidence/build-config-before-after.txt` records.
  const source = readFileSync(MODULE_SOURCE, 'utf8')
  // Prose may NAME the global (the module header explains why it is avoided);
  // only CODE positions matter, so strip comments before scanning.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const withoutStructuralName = code.split('AbortSignalLike').join('')
  assert.ok(
    !/\bAbortSignal\b/.test(withoutStructuralName),
    'the module must not name the ambient DOM global AbortSignal (TS2304 under tsconfig.build.json); declare a structural type instead',
  )
  assert.match(source, /export interface AbortSignalLike/, 'the structural abort surface must be declared locally')
  const buildConfig = readFileSync(join(REPO_ROOT, 'packages', 'tools', 'tsconfig.build.json'), 'utf8')
  assert.ok(
    !/["']test["']/.test(buildConfig),
    'the production compile face must keep excluding the test graph (that graph is what hides ambient globals)',
  )
})

test('host-free arms: lane, disposal, overlap, swap and generation are green on the shipped module', async (t) => {
  const results = await runAllArms(nativeFsBinding)
  for (const result of results) t.diagnostic(`${result.id}: ${result.ok ? 'GREEN' : 'RED'} — ${result.detail}`)
  const failed = results.filter((result) => !result.ok)
  assert.deepEqual(failed, [], `host-free arms failed: ${JSON.stringify(failed, null, 2)}`)
  assert.equal(results.length, 7)
})

test('mutation transcript: every negative control is RED without the behaviour and GREEN with it', async (t) => {
  const transcript = await runMutationTranscript()
  for (const line of transcript.lines) t.diagnostic(line)
  assert.equal(transcript.ok, true, `mutation transcript was red: ${transcript.failures.join('; ')}`)
  const armLines = transcript.lines.filter((line) => line.startsWith('MUTATION-ARM id='))
  assert.equal(armLines.length, 6, 'all six mutation arms must appear in the transcript')
  assert.ok(
    transcript.lines.includes('MUTATION-BASELINE-VERDICT GREEN arms=7'),
    'the shipped module must be green on all seven arms',
  )
  for (const line of armLines) assert.match(line, /verdict=RED-AS-REQUIRED/, `mutation stayed green: ${line}`)
})

test('assembly: a real Member on rc.5 writes inside the lane and is refused outside it', async (t) => {
  assertNextHostTree(REPO_ROOT)
  const world = await makeAssembledMemberWorld({
    repoRoot: REPO_ROOT,
    lane: { read: ['inside'], write: ['inside'] },
    generation: GENERATION,
    label: 'assembly-deny',
  })
  try {
    t.diagnostic(`host=${GENERATION} tree=${world.host.tree}`)
    t.diagnostic(`member=${world.realm.installation.members[0].identity.memberInstanceId}`)
    t.diagnostic(`attach=${JSON.stringify(world.nativeAttachRecord)}`)

    const insidePath = join(world.inside, 'created.txt')
    const allowed = await world.dispatch('write', { file_path: insidePath, content: 'ute1 confined write\n' })
    assert.equal(allowed.isError, false, `the in-lane write must succeed, got: ${allowed.text}`)
    assert.equal(readFileSync(insidePath, 'utf8'), 'ute1 confined write\n')

    const outsidePath = join(world.outside, 'escape.txt')
    const refused = await world.dispatch('write', { file_path: outsidePath, content: 'evil\n' })
    assert.equal(refused.isError, true, 'the out-of-lane write must be refused')
    assert.equal(refused.code, 'FS_PERMISSION_DENIED', `typed refusal code drifted: ${refused.code}`)
    assert.match(refused.text, /lane-write/, 'the refusal must name the lane class')
    assert.equal(existsSync(outsidePath), false, 'no out-of-lane file may appear')

    // The facts are the PRODUCT MODULE's, attributed to this binding and to the
    // pinned generation — not to the harness or to a base provider.
    const allowFact = world.facts.find((fact) => fact.decision === 'allow' && fact.method === 'writeText')
    const denyFact = world.facts.find((fact) => fact.decision === 'deny')
    assert.ok(allowFact !== undefined, 'an allow fact must be recorded for the confined write')
    assert.ok(denyFact !== undefined, 'a deny fact must be recorded for the refused write')
    assert.equal(allowFact.bindingId, 'assembly-assembly-deny')
    assert.equal(denyFact.refusal, 'lane-write')
    assert.equal(denyFact.path, outsidePath)
    assert.equal(denyFact.generation, GENERATION)

    // The provider that SERVED the call is the product module's class (the realm
    // wraps it with the product guard; the wrapper subclasses our class).
    assert.ok(
      world.memberProvider instanceof world.providerClass,
      'the mounted Member provider must be the product module\u2019s confined class',
    )
    assert.equal(world.memberProvider.laneFacts.length, world.facts.length)
  } finally {
    await world.dispose()
  }
})

test('assembly control: without the product module the SAME out-of-lane call falls back and succeeds', async (t) => {
  const world = await makeAssembledMemberWorld({
    repoRoot: REPO_ROOT,
    lane: { read: ['inside'], write: ['inside'] },
    generation: GENERATION,
    label: 'assembly-fallback',
    withProviderClass: false,
  })
  try {
    const outsidePath = join(world.outside, 'fallback-escape.txt')
    const result = await world.dispatch('write', { file_path: outsidePath, content: 'fallback\n' })
    t.diagnostic(`fallback isError=${result.isError} code=${result.code ?? '-'} text=${JSON.stringify(result.text.slice(0, 120))}`)
    assert.equal(result.isError, false, 'the fallback control must NOT be refused (it has no lane) — otherwise the deny arm did not measure the binding')
    assert.equal(existsSync(outsidePath), true, 'the fallback control must land the out-of-lane file')
    assert.deepEqual(world.facts, [], 'the fallback control must record no binding fact')
  } finally {
    await world.dispose()
  }
})

test('scope lifecycle: dispose refuses by name, is idempotent, and never resurrects the lane', async (t) => {
  const world = await makeAssembledMemberWorld({
    repoRoot: REPO_ROOT,
    lane: { read: ['inside'], write: ['inside'] },
    generation: GENERATION,
    label: 'assembly-lifecycle',
  })
  try {
    const insidePath = join(world.inside, 'before-dispose.txt')
    const before = await world.dispatch('write', { file_path: insidePath, content: 'before\n' })
    assert.equal(before.isError, false)

    // Resolve a locator while the scope is live: the held-reference arm then
    // passes the PROVIDER'S OWN locator (not a raw string), so the product guard
    // in front of the binding admits it and the binding's own scope check is the
    // only thing left to refuse.
    const heldLocator = await world.memberProvider.resolve(insidePath)

    const receipt = world.scope.dispose('ute1-scope-ended')
    assert.equal(receipt.status, 'disposed')
    assert.equal(receipt.changed, true)
    const repeat = world.scope.dispose('again')
    assert.equal(repeat.changed, false, 'double dispose must be a named no-op')
    assert.equal(repeat.alreadyDisposed, true)
    assert.equal(repeat.reason, 'ute1-scope-ended')

    // Use-after-dispose: the tool dispatch still exists (the realm is mounted),
    // and the call is refused with the NAMED scope reason — not allowed, not a
    // crash on a torn-down service.
    const afterPath = join(world.inside, 'after-dispose.txt')
    const after = await world.dispatch('write', { file_path: afterPath, content: 'after\n' })
    t.diagnostic(`after dispose: isError=${after.isError} code=${after.code ?? '-'} text=${JSON.stringify(after.text.slice(0, 160))}`)
    assert.equal(after.isError, true, 'a write after scope disposal must be refused')
    assert.match(after.text, /scope-disposed/, 'the refusal must NAME scope-disposed')
    assert.equal(existsSync(afterPath), false, 'no bytes may follow a disposal')

    // The HELD provider reference is refused the same way: the lifecycle state
    // is a property of the SCOPE, so a reference captured before teardown cannot
    // keep serving after it.
    await assert.rejects(
      () => world.memberProvider.writeText(heldLocator, 'held\n'),
      (error) => /scope-disposed/.test(String(error?.message)),
    )
    assert.equal(existsSync(join(world.inside, 'held.txt')), false)
    const scopedFact = world.facts.find((fact) => fact.refusal === 'scope-disposed')
    assert.ok(scopedFact !== undefined, 'a scope-disposed fact must be recorded')
  } finally {
    await world.dispose()
  }
})

test('wrong host generation is refused by name and never falls back to the legacy tree', async () => {
  // The test-side loader refuses a missing tree BY CODE (no path, no fallback).
  assert.throws(
    () => assertNextHostTree('/nonexistent-ute1-repo-root'),
    (error) => {
      assert.equal(error.code, 'TREE_MISSING')
      assert.ok(!/deepseek-harness-test-use/.test(String(error.message)), 'a refusal may not name the legacy tree as a fallback')
      return true
    },
  )
  // The product mount refuses a mismatched generation BEFORE any scope exists.
  const host = {
    generation: '0.2.0-rc.2',
    LocalFileSystem: class {},
    FsError: class extends Error {},
    toolFs: { name: 'fake' },
  }
  const ctx = { isolate() { throw new Error('the generation pin must fire before the scope is created') } }
  await assert.rejects(
    () => nativeFsBinding.mountNativeFsBinding({
      ctx,
      host,
      lane: { read: ['/a'], write: ['/a'] },
      expectedGeneration: GENERATION,
      cwd: '/',
    }),
    (error) => {
      assert.equal(error.code, 'FS_BINDING_HOST_GENERATION_MISMATCH')
      assert.match(error.message, new RegExp(GENERATION.replaceAll('.', '\\.')))
      assert.match(error.message, /0\.2\.0-rc\.2/)
      assert.ok(!/deepseek-harness-test-use/.test(error.message))
      return true
    },
  )
})

test('golden parity: the product module reproduces the 10 old-path vectors', async (t) => {
  const { records, comparison, host } = await runProductGolden({ repoRoot: REPO_ROOT })
  t.diagnostic(`golden host=${GENERATION} commit=${host.commit} commit-tree=${host.tree}`)
  for (const verdict of comparison.verdicts) {
    t.diagnostic(`golden ${verdict.id}: ${verdict.ok ? 'PASS' : `FAIL ${JSON.stringify(verdict.diffs)}`}`)
  }
  assert.equal(records.length, 10)
  assert.deepEqual(comparison.missingObserved, [])
  assert.deepEqual(comparison.missingGolden, [])
  assert.deepEqual(comparison.failures, [], `golden vectors diverged: ${JSON.stringify(comparison.failures, null, 2)}`)
})

test('disclosure: both retirement-blocking semantic differences are still declared', () => {
  const lines = semanticDifferenceLines()
  assert.equal(lines.length, 2, 'the two G1-S1 semantic differences must be carried forward, not resolved silently')
  for (const line of lines) assert.match(line, /blocking=yes/)
  assert.ok(lines.some((line) => line.includes('id=lane-refusal-code')))
  assert.ok(lines.some((line) => line.includes('id=refusal-observation-shape')))
})
