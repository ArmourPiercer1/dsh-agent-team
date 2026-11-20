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
 *   4b. DISPOSAL RACES (review §3.3): dispose drains admitted work before it
 *      confirms release, a drain timeout is `termination-unconfirmed` and never
 *      flips later, draining vs released refusals are distinct names, a receipt
 *      cannot imply a fact it did not measure, and a throwing diagnostic
 *      `record` callback changes nothing
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
import { createFakeContext, createFakeHost } from './lib/fake-host.mjs'
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
  assert.equal(results.length, 12)
})

test('mutation transcript: every negative control is RED without the behaviour and GREEN with it', async (t) => {
  const transcript = await runMutationTranscript()
  for (const line of transcript.lines) t.diagnostic(line)
  assert.equal(transcript.ok, true, `mutation transcript was red: ${transcript.failures.join('; ')}`)
  const armLines = transcript.lines.filter((line) => line.startsWith('MUTATION-ARM id='))
  assert.equal(armLines.length, 11, 'all eleven mutation arms must appear in the transcript')
  assert.ok(
    transcript.lines.includes('MUTATION-BASELINE-VERDICT GREEN arms=12'),
    'the shipped module must be green on all twelve arms',
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

    const receipt = await world.scope.dispose('ute1-scope-ended')
    assert.equal(receipt.state, 'released')
    assert.equal(receipt.changed, true)
    assert.equal(receipt.drained, true)
    assert.equal(receipt.releaseConfirmed, true)
    const repeat = await world.scope.dispose('again')
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
    // Lifecycle refusals are NOT lane facts (no admission was evaluated), so the
    // fact stream must be unchanged by the two post-disposal attempts: the
    // receipt plus the thrown name are the lifecycle evidence.
    const allowFactsAfter = world.facts.filter((fact) => fact.decision === 'allow').length
    assert.equal(allowFactsAfter, 1, 'exactly the pre-disposal write may have produced an allow fact')
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
  const { records, comparison, host, imagePending } = await runProductGolden({ repoRoot: REPO_ROOT })
  t.diagnostic(`golden host=${GENERATION} commit=${host.commit} commit-tree=${host.tree}`)
  for (const verdict of comparison.verdicts) {
    t.diagnostic(`golden ${verdict.id}: ${verdict.ok ? 'PASS' : `FAIL ${JSON.stringify(verdict.diffs)}`}`)
  }
  assert.equal(records.length, 10)
  // The 6 image rows are EXCLUDED, not ignored: this module serves read/write/
  // edit only until PR B2. If an image vector ever stops being declared pending,
  // this assertion fails and forces the parity claim to grow with the module.
  // (The seventh row, FS-I0-route-c-gap, was the product-route failure pin; the
  // 2026-11-20 route-C repair made it obsolete and the corpus entry was deleted
  // rather than re-pointed, because FS-I1 already is the in-lane allow baseline.)
  assert.deepEqual(
    imagePending.map((vector) => vector.id),
    ['FS-I1-inlane-image', 'FS-I2-outside-image-denied', 'FS-I3-lane-bound-image', 'FS-I4-missing-image', 'FS-I5-route-unresolved', 'FS-I6-cancel-before-dispatch'],
  )
  assert.ok(imagePending.every((vector) => vector.newPathPending === true), 'excluded image vectors must still be declared new-path-pending')
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

/** A promise that resolves after `ms` (test-local; no fake timers). */
function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

/**
 * A fake host whose provider parks inside `stat` until `release()` is called.
 * `parked` resolves as soon as one admitted operation has reached the park, so a
 * test can be certain the operation is IN FLIGHT before it disposes the scope.
 */
function parkableHost() {
  let releasePark
  const gate = new Promise((resolve) => { releasePark = resolve })
  let arrived
  const parked = new Promise((resolve) => { arrived = resolve })
  const host = createFakeHost({
    park: async (method) => {
      if (method !== 'stat') return
      arrived()
      await gate
    },
  })
  return { host, parked, release: () => releasePark() }
}

/** Mount the product binding on the fake host with a short, explicit drain bound. */
async function mountOnFake(host, { id, drainTimeoutMs = 2_000, record, ctx = createFakeContext() } = {}) {
  return nativeFsBinding.mountNativeFsBinding({
    ctx,
    host,
    lane: { read: ['/world/inside'], write: ['/world/inside'] },
    expectedGeneration: host.generation,
    id,
    cwd: '/world',
    ...(drainTimeoutMs === undefined ? {} : { drainTimeoutMs }),
    ...(record === undefined ? {} : { record }),
  })
}

test('lifecycle race A: dispose WAITS for an admitted operation and no effect lands after the receipt', async (t) => {
  const { host, parked, release } = parkableHost()
  const binding = await mountOnFake(host, { id: 'race-a', drainTimeoutMs: 2_000 })
  const target = '/world/inside/race-a.txt'
  const pending = binding.provider.writeText(target, 'race-a\n').catch((error) => error)
  await parked
  assert.equal(binding.inFlight, 1, 'the parked write must be counted as in flight')

  let returned = false
  const disposal = binding.dispose('race-a').then((receipt) => {
    returned = true
    return receipt
  })
  await sleep(40)
  assert.equal(returned, false, 'dispose() must not return while an admitted operation is parked')
  assert.equal(binding.status, 'draining', 'the scope must be draining while it waits')

  release()
  const receipt = await disposal
  const result = await pending
  t.diagnostic(`receipt=${JSON.stringify(receipt)} write=${result instanceof Error ? result.message : 'ok'}`)

  assert.equal(result instanceof Error, false, 'the admitted operation must complete, not be refused')
  assert.equal(receipt.state, 'released')
  assert.equal(receipt.drained, true)
  assert.equal(receipt.releaseConfirmed, true)
  assert.equal(receipt.inFlightAtDispose, 1)

  // The load-bearing measurement: the effect is already on disk when the receipt
  // arrives, and NOTHING changes afterwards. A counter alone would not prove this.
  const bytesAtReceipt = host.files.get(target)
  const entriesAtReceipt = [...host.files.keys()].sort().join('|')
  await sleep(60)
  assert.equal(bytesAtReceipt, 'race-a\n')
  assert.equal(host.files.get(target), bytesAtReceipt, 'no bytes may change after the receipt')
  assert.equal([...host.files.keys()].sort().join('|'), entriesAtReceipt, 'no file may appear after the receipt')
  assert.equal(binding.status, 'released')
  assert.equal(binding.inFlight, 0)
})

test('lifecycle race B: a drain timeout is termination-unconfirmed, never released, and never flips later', async (t) => {
  const { host, parked, release } = parkableHost()
  const binding = await mountOnFake(host, { id: 'race-b', drainTimeoutMs: 25 })
  const target = '/world/inside/race-b.txt'
  const pending = binding.provider.writeText(target, 'race-b\n').catch((error) => error)
  await parked

  const receipt = await binding.dispose('race-b')
  t.diagnostic(`receipt=${JSON.stringify(receipt)}`)
  assert.equal(receipt.state, 'termination-unconfirmed')
  assert.equal(receipt.drained, false)
  assert.equal(receipt.releaseConfirmed, false)
  assert.equal(receipt.newOperationsRefused, true)
  assert.equal(receipt.refusalCode, 'scope-termination-unconfirmed')
  assert.match(receipt.reason, /drain-timeout/)
  assert.equal(binding.status, 'termination-unconfirmed')

  // Let the parked call finish: the binding must NOT silently become released.
  release()
  await pending
  await sleep(40)
  assert.equal(binding.status, 'termination-unconfirmed', 'a late-finishing operation may not resurrect release')
  const repeat = await binding.dispose('again')
  assert.equal(repeat.state, 'termination-unconfirmed')
  assert.equal(repeat.drained, false)
  assert.equal(repeat.releaseConfirmed, false)
  assert.equal(repeat.changed, false)
})

test('lifecycle race C: draining and released refusals are distinct, create no fact and no effect', async (t) => {
  const { host, parked, release } = parkableHost()
  const facts = []
  const binding = await mountOnFake(host, { id: 'race-c', drainTimeoutMs: 2_000, record: (fact) => facts.push(fact) })
  const pending = binding.provider.writeText('/world/inside/race-c.txt', 'first\n').catch((error) => error)
  await parked
  const disposal = binding.dispose('race-c')
  await sleep(15)

  const duringPromise = binding.provider.writeText('/world/inside/race-c-during.txt', 'no\n').catch((error) => error)
  const during = await Promise.race([duringPromise, sleep(150).then(() => 'still-admitted')])
  t.diagnostic(`during draining: ${during instanceof Error ? `${during.code} ${during.message.slice(0, 120).trimEnd()}` : during}`)
  assert.ok(during instanceof Error, 'a call during draining must be refused')
  assert.equal(during.code, 'FS_PERMISSION_DENIED')
  assert.match(during.message, /scope-draining/)
  assert.doesNotMatch(during.message, /scope-disposed/)

  release()
  const receipt = await disposal
  await pending
  await duringPromise
  assert.equal(receipt.state, 'released')
  const factsBefore = facts.length
  const after = await binding.provider.writeText('/world/inside/race-c-after.txt', 'no\n').catch((error) => error)
  t.diagnostic(`after released: ${after instanceof Error ? `${after.code} ${after.message.slice(0, 120).trimEnd()}` : after}`)
  assert.ok(after instanceof Error)
  assert.match(after.message, /scope-disposed/)
  assert.doesNotMatch(after.message, /scope-draining/)
  assert.equal(host.files.has('/world/inside/race-c-during.txt'), false)
  assert.equal(host.files.has('/world/inside/race-c-after.txt'), false)
  assert.equal(facts.length, factsBefore, 'lifecycle refusals must not append lane facts')
})

test('lifecycle race D: a receipt never claims more than it measured (throwing record arm)', async (t) => {
  const host = createFakeHost()
  let attempts = 0
  const delivered = []
  const binding = await mountOnFake(host, {
    id: 'race-d',
    drainTimeoutMs: 1_000,
    // The recorder is DIAGNOSTIC ONLY. It throws on its first delivery; the
    // operation must still succeed, no fact may be delivered, and the binding's
    // own fact buffer must be unaffected. This is why `record` must never be used
    // as the S1 durable-settlement path: its failure is swallowed by design.
    record: (fact) => {
      attempts += 1
      if (attempts === 1) throw new Error('recorder exploded')
      delivered.push(fact)
    },
  })
  const result = await binding.provider.writeText('/world/inside/race-d.txt', 'race-d\n').catch((error) => error)
  assert.equal(result instanceof Error, false, 'a throwing recorder may not change the operation outcome')
  assert.equal(host.files.get('/world/inside/race-d.txt'), 'race-d\n')
  assert.equal(attempts, 1, 'the recorder is offered the fact exactly once')
  assert.equal(delivered.length, 0, 'a throwing recorder delivers zero facts (and is not retried)')
  assert.equal(binding.facts.length, 1, "the binding's own evidence does not depend on the recorder")
  const receipt = await binding.dispose('race-d')
  assert.equal(receipt.state, 'released')
  assert.equal(receipt.releaseConfirmed, true)
  t.diagnostic(`attempts=${attempts} delivered=${delivered.length} binding-facts=${binding.facts.length} receipt=${JSON.stringify(receipt)}`)
})
