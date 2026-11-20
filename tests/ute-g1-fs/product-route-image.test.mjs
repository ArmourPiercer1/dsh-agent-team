/**
 * product-route-image.test.mjs — the FS family's FOURTH member on the PRODUCT
 * route-C composition (UTE-3 route-C repair, 2026-11-20).
 *
 * THE DEFECT THIS PINS (measured pre-fix, `golden/COVERAGE.md` history): the
 * pinned host's `@deepseek-ai/dsh-tool-fs` registers `read`/`write`/`edit`
 * directly on the module context but registers `read_image` from a deferred
 * `ctx.inject(['attachments'], …)` child (`tool-fs/src/index.ts`). The module
 * declares `inject = ['tools', 'fs', 'systemPrompt']`; its three direct rows
 * execute against that `fs`, and the deferred `read_image` body also reads
 * `ctx.fs` (`tool-fs/src/read-image.ts`: `resolveRegularReadTarget(ctx, …)`
 * then `ctx.fs.readBytes(…)`). The routed mount only merged the services the
 * ROUTER provides (`tools`, `systemPrompt`) into a deferred child's inject map,
 * so the child hit Cordis's isolate-label refusal — `cannot get property "fs"
 * without inject` — before any provider call: zero reads, zero attachments.
 *
 * THE REPAIR UNDER TEST (`packages/runtime/team-services/src/mount.ts`): a
 * routed module's OWN declared service is continued into its deferred children
 * (`continuedServiceNamesOf`). Only the NAME is merged; the OBJECT is resolved
 * by Cordis on the child's own scope chain, anchored at the Member realm's
 * `root.isolate('fs', …)` scope where `install.ts` mounted the CONFINED
 * provider. These arms exist to make that claim falsifiable:
 *
 *   1. in-lane allow  — exactly ONE attachment, whose bytes are digested at the
 *      store's own `saveImage` seam, after one `stat` + one `readBytes` on the
 *      CONFINED provider, with the guard's own allow facts (realm=member);
 *   2. out-of-lane deny — the lane's refusal, the outside file byte-identical,
 *      ZERO attachment bytes, ZERO provider calls;
 *   3. a text-only route — the tool's own route gate refuses before any read;
 *   4. aborted-before-dispatch — the registry's refusal, nothing materialised;
 *   5. MUTATION `unconfined-fs` — the SAME host module mounted on a scope whose
 *      `fs` is the inherited BASE provider turns the SAME out-of-lane call into
 *      an allow that materialises the outside bytes. That is exactly what these
 *      arms would observe if the repair had continued a root/unconfined service
 *      into the child instead of the realm's confined provider, so arm 2 is
 *      load-bearing rather than decorative.
 *
 * The other three members are NOT re-proved here: their old-path rows are
 * re-captured byte-identically (`capture-old-path.mjs --write`) and graded by
 * `lane-suite.test.mjs` / `tests/ute1-fs/native-fs-binding.test.mjs`.
 *
 * HOST-REQUIRED, FAIL-LOUD: the world factory loads the pinned baseline's BUILT
 * entries and throws when they are absent (no skip path).
 *
 * @module tests/ute-g1-fs/product-route-image
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { loadFsContractSeams, makeFsContractWorld, PIXEL_PNG } from '../world-factory/lib/a5sf-fs-contract-world.mjs'
import { sha256Of } from './lib/effect-oracle.mjs'

const REPO_ROOT = process.cwd()

/** The five provider methods a `read_image` arm could reach, all zero by default. */
const ZERO_CALLS = Object.freeze({
  stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
})

/**
 * Observe the attachment store's OWN commit seam. The digest is taken from the
 * bytes the store received, never from the tool's self-reported metadata.
 * @param {object} world - a built contract world.
 * @returns {{bytes: number, sha256: string}[]} commits in order.
 */
function observeStore(world) {
  const store = world.root.get('attachments')
  assert.notEqual(store, undefined, 'the world must expose the attachment store')
  assert.equal(typeof store.saveImage, 'function', 'the store seam is saveImage')
  const committed = []
  const original = store.saveImage.bind(store)
  store.saveImage = async (image) => {
    const data = Buffer.from(image.data)
    committed.push({ bytes: data.length, sha256: sha256Of(data) })
    return original(image)
  }
  return committed
}

/** Counter delta for the confined provider's managed surface. */
function callDelta(before, after) {
  const delta = {}
  for (const name of Object.keys(ZERO_CALLS)) delta[name] = (after[name] ?? 0) - (before[name] ?? 0)
  return delta
}

/** The guard facts produced by one call, by `callId`. */
function factsOf(world, callId) {
  return world.facts().filter((fact) => fact.callId === callId)
}

/** The tool error text a model would receive (result text + registry error). */
function failureText(settled) {
  return `${settled.text ?? ''}\n${settled.errorMessage ?? ''}`
}

test('the product route serves read_image inside the declared read lane: one digested attachment on the CONFINED provider', async () => {
  const world = await makeFsContractWorld({ repoRoot: REPO_ROOT, label: 'ute3-product-image-allow', composition: 'route-c' })
  try {
    // The routed definition must really be the one answering (otherwise this arm
    // would be observing the preset row instead of the product attach).
    assert.notEqual(world.routedDefinition, undefined, 'the product attach must expose read_image')
    assert.notEqual(world.routedDefinition, world.presetDefinition, 'the routed definition shadows the preset one')

    const committed = observeStore(world)
    const factsBefore = world.facts().length
    const callsBefore = world.calls()
    const storedBefore = world.attachments.saved.length

    const settled = await world.dispatch('read_image', { file_path: world.fixtures.pixel }, { callId: 'ute3-product-image-in' })

    assert.equal(settled.isError, false, `the product route must serve an in-lane read_image: ${failureText(settled)}`)
    assert.equal(
      /cannot get property ["']?fs["']? without inject/u.test(failureText(settled)),
      false,
      'the historical GAP-FS-CONTRACT-1 fault must not appear on the product route any more',
    )

    // 1. EXACTLY ONE attachment, digested where it was committed.
    assert.equal(committed.length, 1, 'an allowed read_image must commit EXACTLY ONE attachment')
    assert.equal(committed[0].bytes, PIXEL_PNG.length, 'the store received the file bytes, not a re-encoding')
    assert.equal(committed[0].sha256, sha256Of(PIXEL_PNG), 'the store received the fixture bytes byte-for-byte')
    assert.equal(world.attachments.saved.length, storedBefore + 1, 'the store recorded one attachment')
    const ref = world.attachments.saved.at(-1)
    assert.equal(ref.bytes, PIXEL_PNG.length)
    assert.equal(ref.mediaType, 'image/png')
    assert.deepEqual([ref.width, ref.height], [1, 1])

    // 2. The model-facing value is the SAME commit (no second materialisation).
    assert.equal(settled.value?.image?.attachmentId, ref.attachmentId, 'the tool value names the committed attachment')
    const blocks = Array.isArray(settled.content) ? settled.content : []
    assert.deepEqual(blocks.map((part) => part?.type), ['text', 'image'], 'the result is one text envelope + one image block')
    assert.equal(blocks[1]?.attachment?.attachmentId, ref.attachmentId, 'the image block references the committed attachment')

    // 3. The CONFINED provider served the read: exactly one stat, one readBytes.
    assert.deepEqual(callDelta(callsBefore, world.calls()), {
      ...ZERO_CALLS, stat: 1, readBytes: 1,
    }, 'exactly one stat + one readBytes through the confined provider')

    // 4. The lane was consulted, on the MEMBER realm, for this call.
    const facts = factsOf(world, 'ute3-product-image-in')
    assert.equal(facts.length, 2, 'one admission per read operation')
    assert.deepEqual(facts.map((fact) => [fact.method, fact.decision, fact.decidedBy]), [
      ['stat', 'allow', 'ALLOW'],
      ['readBytes', 'allow', 'ALLOW'],
    ], 'the order is stat → readBytes, each admitted once')
    for (const fact of facts) {
      assert.equal(fact.realm, 'member')
      assert.equal(fact.memberIdentity, 'member-a5sf-fs-contract')
      assert.equal(fact.tool, 'read_image')
      assert.equal(fact.schema, 'a5sf-guard-consult/1')
    }
    assert.equal(world.facts().length, factsBefore + 2, 'no other guard fact was produced')
    console.log(`UTE3-ROUTE-C-ALLOW entry=read_image storeBytes=${committed[0].bytes} storeSha256=${committed[0].sha256} facts=${facts.length}`)
  } finally {
    await world.dispose()
  }
})

test('read_image outside the declared lane is REFUSED: zero attachment bytes, outside file unchanged, zero provider reads', async () => {
  const world = await makeFsContractWorld({ repoRoot: REPO_ROOT, label: 'ute3-product-image-deny', composition: 'route-c' })
  try {
    const committed = observeStore(world)
    const outsideBefore = readFileSync(world.fixtures.secretPng)
    const factsBefore = world.facts().length
    const callsBefore = world.calls()
    const storedBefore = world.attachments.saved.length
    const bytesBefore = world.attachments.saved.reduce((sum, ref) => sum + ref.bytes, 0)

    const settled = await world.dispatch('read_image', { file_path: world.fixtures.secretPng }, { callId: 'ute3-product-image-out' })

    assert.equal(settled.isError, true, 'an out-of-lane image must be refused')
    assert.match(failureText(settled), /outside every allow subtree of the lane/u, 'the refusal is the LANE\'s')
    assert.equal(
      /cannot get property ["']?fs["']? without inject/u.test(failureText(settled)),
      false,
      'the refusal must be the lane, not the composition fault this repair removed',
    )
    assert.equal(committed.length, 0, 'a refused image commits NO attachment')
    assert.equal(world.attachments.saved.length, storedBefore, 'no store record was created')
    assert.equal(world.attachments.saved.reduce((sum, ref) => sum + ref.bytes, 0), bytesBefore, 'ZERO attachment bytes')
    assert.equal(sha256Of(readFileSync(world.fixtures.secretPng)), sha256Of(outsideBefore), 'the outside file is byte-identical after the refusal')

    assert.deepEqual(callDelta(callsBefore, world.calls()), ZERO_CALLS, 'ZERO provider reads: the guard refused before super.stat and readBytes never ran')

    const facts = factsOf(world, 'ute3-product-image-out')
    assert.deepEqual(facts.map((fact) => [fact.method, fact.decision]), [['stat', 'deny']], 'one stat deny fact, no read admission')
    assert.equal(facts[0]?.realm, 'member', 'the MEMBER realm refused it (the base provider has no lane at all)')
    assert.equal(world.facts().length, factsBefore + 1, 'no other guard fact was produced')
    console.log('UTE3-ROUTE-C-DENY entry=read_image committed=0 providerCalls=0 facts=1')
  } finally {
    await world.dispose()
  }
})

test('a text-only model route refuses the image modality before any read', async () => {
  const world = await makeFsContractWorld({
    repoRoot: REPO_ROOT,
    label: 'ute3-product-image-text-only',
    composition: 'route-c',
    llmModalities: ['text'],
  })
  try {
    const committed = observeStore(world)
    const callsBefore = world.calls()
    const resolutionsBefore = world.llmResolutions.length
    const factsBefore = world.facts().length

    const settled = await world.dispatch('read_image', { file_path: world.fixtures.pixel }, { callId: 'ute3-product-image-text-only' })

    assert.equal(settled.isError, true, 'a text-only route must be refused')
    assert.match(failureText(settled), /does not declare image input/u, 'the TOOL route gate refused')
    assert.match(failureText(settled), /switch to an image-capable model/u, 'and names the remedy')
    assert.equal(
      /cannot get property ["']?fs["']? without inject/u.test(failureText(settled)),
      false,
      'the refusal must precede the deferred child\'s ctx.fs access',
    )
    assert.equal(committed.length, 0, 'ZERO attachment bytes')
    assert.equal(world.llmResolutions.length, resolutionsBefore + 1, 'exactly ONE route resolution')
    assert.deepEqual(world.llmResolutions.at(-1), { provider: 'mock-provider', model: 'mock-model' }, 'the gate resolved the CALLING route')
    assert.deepEqual(callDelta(callsBefore, world.calls()), ZERO_CALLS, 'ZERO provider I/O: the gate refuses first')
    assert.equal(world.facts().length, factsBefore, 'ZERO guard facts: the lane was never consulted')
  } finally {
    await world.dispose()
  }
})

test('an aborted-before-dispatch read_image is still refused and materialises nothing', async () => {
  const world = await makeFsContractWorld({ repoRoot: REPO_ROOT, label: 'ute3-product-image-abort', composition: 'route-c' })
  try {
    const committed = observeStore(world)
    const pixelBefore = readFileSync(world.fixtures.pixel)
    const callsBefore = world.calls()
    const factsBefore = world.facts().length
    const controller = new AbortController()
    controller.abort()

    const settled = await world.dispatch('read_image', { file_path: world.fixtures.pixel }, { callId: 'ute3-product-image-abort', signal: controller.signal })

    assert.equal(settled.isError, true, 'an aborted-before-dispatch call must be refused')
    assert.match(failureText(settled), /aborted before dispatch/u, 'the registry\'s own refusal')
    assert.equal(committed.length, 0, 'no attachment may be materialised')
    assert.equal(sha256Of(readFileSync(world.fixtures.pixel)), sha256Of(pixelBefore), 'the image file is unchanged')
    assert.deepEqual(callDelta(callsBefore, world.calls()), ZERO_CALLS, 'ZERO provider I/O')
    assert.equal(world.facts().length, factsBefore, 'ZERO guard facts')
  } finally {
    await world.dispose()
  }
})

/**
 * MUTATION `unconfined-fs` — THE control that makes the confinement claim
 * falsifiable.
 *
 * It mounts the SAME pinned host module on a scope that inherits the BASE
 * `LocalFileSystem` from the world root (no `root.isolate('fs', …)` realm
 * scope, no confined provider, no lane). The module's deferred `read_image`
 * child resolves that base service — the base is NOT an isolated service, so no
 * inject merge is needed for it to resolve — and the SAME out-of-lane call that
 * arm 2 refuses is ALLOWED and materialises the outside bytes.
 *
 * Therefore, if the repair had continued a root/unconfined `fs` into the
 * deferred child instead of the realm's confined provider, arm 2 would observe
 * this mutant's result (allow + 70 bytes + no guard fact) and go RED.
 */
test('MUTATION unconfined-fs: the same module on the base provider allows the same out-of-lane read', async () => {
  const world = await makeFsContractWorld({ repoRoot: REPO_ROOT, label: 'ute3-product-image-unconfined', composition: 'route-c' })
  try {
    const committed = observeStore(world)

    // Baseline: the product route denies the out-of-lane call with zero bytes.
    const confined = await world.dispatch('read_image', { file_path: world.fixtures.secretPng }, { callId: 'ute3-unconfined-baseline' })
    assert.equal(confined.isError, true, 'the product route (confined) denies the out-of-lane image')
    assert.equal(committed.length, 0, 'the product route materialises nothing')

    // The mutant: a sibling scope under the same root whose `fs` is the base
    // provider. Its `bindScopeParent` makes it an agent scope of the same world,
    // so this is the SAME dispatch path — only the resolved `fs` differs.
    const seams = await loadFsContractSeams(REPO_ROOT)
    const key = {
      session: {
        header: { cwd: world.fixtures.inside },
        requestHeader: () => ({ config: { provider: 'mock-provider', model: 'mock-model' } }),
      },
      options: {},
    }
    const scope = seams.createScope(world.root, key)
    seams.bindScopeParent(key, world.agentKey)
    await scope.ctx.plugin(seams.nativeToolModules)
    const deadline = Date.now() + 5_000
    while (world.root.get('tools').get('read_image', key) === undefined && Date.now() < deadline) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    assert.notEqual(world.root.get('tools').get('read_image', key), undefined, 'the mutant module registered read_image on the base-provider scope')

    const before = world.attachments.saved.length
    const factsBefore = world.facts().length
    const settled = await world.root.get('tools').execute({
      signal: new AbortController().signal,
      callId: 'ute3-unconfined-mutant',
      name: 'read_image',
      arguments: { file_path: world.fixtures.secretPng },
      agent: key,
    })
    const text = Array.isArray(settled.content)
      ? settled.content.map((part) => (part?.type === 'text' ? part.text : part?.type === 'image' ? '<image>' : '')).join('')
      : ''

    assert.equal(settled.isError, false, `the unconfined mutant must ALLOW what the product route denies (got: ${text})`)
    assert.equal(world.attachments.saved.length, before + 1, 'the mutant materialised the outside image')
    assert.equal(world.attachments.saved.at(-1)?.bytes, PIXEL_PNG.length, 'the outside bytes were committed')
    assert.equal(committed.length, 1, 'the store seam observed exactly that one unconfined commit')
    assert.equal(committed[0]?.sha256, sha256Of(PIXEL_PNG), 'and it is the out-of-lane fixture, byte-for-byte')
    assert.equal(factsOf(world, 'ute3-unconfined-mutant').length, 0, 'the base provider consults NO lane: zero guard facts')
    assert.equal(world.facts().length, factsBefore, 'the mutation produced no guard fact at all')
    console.log('UTE3-ROUTE-C-MUTATION unconfined-fs confined=deny/0B mutant=allow/70B guardFacts=0')
  } finally {
    await world.dispose()
  }
})

test('the continuation is scoped to services the module ITSELF declares: a module without fs gets a shape-identical inject map', async () => {
  // The router continues `fs` into deferred children. That widening is bounded
  // by the module's OWN declaration: the pure merge is unit-pinned here so the
  // bound cannot silently drift when a new module is mounted through the seam.
  const { continuedServiceNamesOf, mergeRoutedInject } = await import('../../packages/runtime/team-services/src/mount.ts')

  // 1. Which module declarations yield a continuation.
  assert.deepEqual(continuedServiceNamesOf({ inject: ['tools', 'fs', 'systemPrompt'] }), ['fs'], 'the FS assembly declares fs')
  assert.deepEqual(continuedServiceNamesOf({ inject: { fs: { required: false }, tools: null } }), ['fs'], 'Cordis object-form Inject is understood too')
  for (const plugin of [
    { inject: ['tools', 'systemPrompt', 'subprocess'] }, // tool-fs-search / confined-search
    { inject: ['tools', 'subprocess'] }, // confined-bash
    { inject: ['tools', 'terminals'] }, // confined-terminal
    { inject: ['tools', 'web', 'systemPrompt'] }, // confined-web / tool-web
    { inject: {} },
    {},
    undefined,
    { inject: 'fs' }, // malformed: not an array/object declaration
  ]) {
    assert.deepEqual(continuedServiceNamesOf(plugin), [], `no continuation for ${JSON.stringify(plugin)}`)
  }

  // 2. A module that does NOT declare fs gets the PRE-FIX map, byte-identically:
  //    same shape, same order, and NO added fs key (so no hidden null inject).
  const arrayNames = ['attachments']
  const arrayBefore = [...arrayNames]
  const arrayMerged = mergeRoutedInject(arrayNames, [])
  assert.equal(Array.isArray(arrayMerged), true, 'an array declaration stays an array')
  assert.deepEqual(arrayMerged, ['attachments', 'tools', 'systemPrompt'], 'the pre-fix array map, unchanged')
  assert.deepEqual(arrayNames, arrayBefore, 'the input array is not mutated')

  const objectNames = { attachments: { filter: 'image-only' } }
  const objectMerged = mergeRoutedInject(objectNames, [])
  assert.equal(Array.isArray(objectMerged), false, 'an object declaration stays an object')
  assert.deepEqual(objectMerged, { attachments: { filter: 'image-only' }, tools: null, systemPrompt: null }, 'the pre-fix object map, unchanged')
  assert.equal('fs' in objectMerged, false, 'NO fs key is added to a module that does not declare it')
  assert.deepEqual(objectNames, { attachments: { filter: 'image-only' } }, 'the input object is not mutated')

  // 3. The widening itself, when declared: what the FS assembly's child gets.
  assert.deepEqual(mergeRoutedInject(['attachments'], ['fs']), ['attachments', 'tools', 'systemPrompt', 'fs'])
  assert.deepEqual(mergeRoutedInject({ attachments: { filter: 'image-only' } }, ['fs']), {
    attachments: { filter: 'image-only' }, tools: null, systemPrompt: null, fs: null,
  })
  console.log('UTE3-ROUTE-C-SCOPE continuedOnlyWhenDeclared=true noFsMapUnchanged=true')
})

/**
 * PROVE THE RESOLVED SERVICE, NOT JUST THAT `ctx.fs` RESOLVES.
 *
 * Cordis gives every access a fresh context-bound proxy (`member.ctx.get('fs')`
 * !== `member.fs`; the proxy's `.constructor` is neither provider class), so an
 * identity assertion would be a false claim — measured, not assumed. This arm
 * therefore proves confinement BEHAVIOURALLY on the child's own `fs`:
 *   - it serves an IN-LANE `resolve`+`stat` (the confined provider's job);
 *   - it REFUSES the same operations on an OUT-OF-LANE path with the lane's own
 *     sentence (a base provider would serve it — the `unconfined-fs` mutation
 *     above measures that on the identical path);
 *   - the two `stat` admissions are recorded as `realm: member` facts for the
 *     Member identity, i.e. the confined provider's guard answered;
 *   - and no fallback exists: with the continuation withheld, the child is
 *     refused with the typed inject fault (world-factory withheld-continuation
 *     arm), never handed a root `fs`.
 *
 * The probe module is mounted through the SAME product router. NOTE: mounting a
 * SECOND router after the attach settles trips the attach's own post-settle
 * re-verification, which withdraws its routers to restore the preset surface;
 * the probe's deferred callback runs during the mount, and this world is
 * disposed immediately after, so the observation is taken before that
 * withdrawal and nothing downstream depends on it.
 */
test('the deferred child\'s fs is the MEMBER\'s confined provider: in-lane served, out-of-lane refused, guard realm=member', async () => {
  const { pathToFileURL } = await import('node:url')
  const probe = await import(pathToFileURL(`${REPO_ROOT}/tests/ute-g1-fs/lib/probe-confined-continuation.mjs`).href)
  const world = await makeFsContractWorld({ repoRoot: REPO_ROOT, label: 'ute3-product-image-probe', composition: 'route-c' })
  try {
    const observation = {}
    const factsBefore = world.facts().length
    await world.realm.mountNativeToolModules([{
      module: probe,
      config: { observation, insidePath: world.fixtures.pixel, outsidePath: world.fixtures.secretPng },
    }])
    const deadline = Date.now() + 5_000
    while (observation.outsideStat === undefined && Date.now() < deadline) {
      await new Promise((resolve) => setImmediate(resolve))
    }

    assert.equal(observation.resolved, true, `the deferred child of an fs-declaring module must resolve ctx.fs (${observation.error ?? 'no error'})`)
    assert.equal(observation.insideStat, 'file', 'the child\'s fs serves an in-lane target')
    assert.equal(observation.outsideStat, 'refused', 'the child\'s fs refuses an out-of-lane target')
    assert.match(observation.outsideRefusal ?? '', /outside every allow subtree of the lane/u, 'with the lane\'s own refusal, not a fallback')

    const facts = world.facts().slice(factsBefore)
    assert.deepEqual(facts.map((fact) => [fact.method, fact.decision]), [['stat', 'allow'], ['stat', 'deny']], 'the child\'s fs went through the guarded provider for both')
    for (const fact of facts) {
      assert.equal(fact.realm, 'member', 'the guard attributes the admission to the Member realm')
      assert.equal(fact.memberIdentity, 'member-a5sf-fs-contract', 'and to THIS Member identity')
    }
    console.log(`UTE3-ROUTE-C-CONFINED childResolved=true inside=${observation.insideStat} outside=${observation.outsideStat} guardRealm=member`)
  } finally {
    await world.dispose()
  }
})
