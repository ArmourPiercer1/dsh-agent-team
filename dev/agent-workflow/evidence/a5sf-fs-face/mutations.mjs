/**
 * mutations.mjs — the mutation controls for the FS face's layer-B arms.
 *
 * WHY THIS EXISTS. Every contract pinned here is UPSTREAM/PRODUCT behaviour that
 * already works, so a plain green run cannot show that an arm is load-bearing:
 * an arm that asserted nothing would also be green. Each control MUTATES one
 * forwarding decision or one compiled lane the lane owns and the matrix claims:
 *
 *   M1  dropVersionGuard            the confined `editText` stops forwarding `expected`.
 *   M2  underreportStatSize         the confined `stat` under-reports the big file's size.
 *   M3  dropWriteSignal             the confined `writeText` stops forwarding `signal`.
 *   M4  silentAttachment            the store answers the `pixel.png` read without recording.
 *   M5  forceReplaceIfVersion       the create target is forced through the REPLACE guard.
 *   M6  widenReadLane               the ceiling's READ lane is recompiled to the write roots.
 *   M7  dropWriteIntent             the unobserved target's write intent stops reaching the provider.
 *   M8  widenBindingTool=edit       the edit binding's restriction is compiled away.
 *   M9  widenBindingTool=write      the write binding's restriction is compiled away.
 *   M10 widenBindingTool=read_image the read_image binding's restriction is compiled away.
 *   M11 forceReplaceAll             the multi-match edit ignores the caller's flag (always true).
 *   M12 dropReplaceAll              the multi-match edit ignores the caller's flag (always false).
 *   M13 silentStreamAbort           the streamed read swallows its abort and ends cleanly.
 *   M14 textOnlyRouteReportsImage   a text-only route claims image input.
 *   D   post-gap-1                  the SAME routed `read_image` refusal arm over the
 *                                   proposed post-GAP-1 composition.
 *
 * A control PASSES when exactly the expected arms go red and every other arm
 * stays green. The mutants live on the mounted instance (or in the compiled lane
 * for M6/M8–M10, because a mounted realm's lane is immutable by design); no
 * committed file is edited and no upstream source is touched.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-fs-face/mutations.mjs
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  armBindingEdit,
  armBindingReadImage,
  armBindingWrite,
  armCreateNewFile,
  armEditAmbiguous,
  armEditFreshControl,
  armEditReplaceAll,
  armEditStaleConflict,
  armImageRouteGateTextOnly,
  armImageRouteGateUnderProductRoute,
  armOverwriteOutsideReadLane,
  armOverwriteUnobservedExisting,
  armReadImageAllowed,
  armReadImageDenied,
  armReadImageRouteCRefusal,
  armReadSmallControl,
  armReadStreamAbort,
  armReadStreamBoundary,
  armWriteAbort,
  armWriteControl,
  FS_CONTRACT_BINDINGS,
  makeFsContractWorld,
} from '../../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')

/** Every arm, the composition/options it needs, and the world label it runs under. */
const ARMS = [
  { id: 'edit-stale', options: { composition: 'route-c' }, run: armEditStaleConflict },
  { id: 'edit-fresh', options: { composition: 'route-c' }, run: armEditFreshControl },
  { id: 'read-boundary', options: { composition: 'route-c' }, run: armReadStreamBoundary },
  { id: 'read-small', options: { composition: 'route-c' }, run: armReadSmallControl },
  { id: 'image-route-c', options: { composition: 'route-c' }, run: armReadImageRouteCRefusal },
  { id: 'image-allowed', options: { composition: 'post-gap-1' }, run: armReadImageAllowed },
  { id: 'image-denied', options: { composition: 'post-gap-1' }, run: armReadImageDenied },
  { id: 'write-abort', options: { composition: 'route-c' }, run: armWriteAbort },
  { id: 'write-control', options: { composition: 'route-c' }, run: armWriteControl },
  // increment 2
  {
    id: 'create-new',
    options: { composition: 'route-c', laneRoots: { read: ['observe'], write: ['inside'] } },
    run: armCreateNewFile,
  },
  {
    id: 'create-outside-read',
    options: { composition: 'route-c', laneRoots: { read: ['observe'], write: ['inside'] } },
    run: armOverwriteOutsideReadLane,
  },
  { id: 'create-unobserved', options: { composition: 'route-c' }, run: armOverwriteUnobservedExisting },
  {
    id: 'bind-edit',
    options: {
      composition: 'route-c',
      bindings: [{ toolBindingIdentity: FS_CONTRACT_BINDINGS.edit, read: ['bound'], write: ['bound'] }],
    },
    run: armBindingEdit,
  },
  {
    id: 'bind-write',
    options: {
      composition: 'route-c',
      bindings: [{ toolBindingIdentity: FS_CONTRACT_BINDINGS.write, read: ['bound'], write: ['bound'] }],
    },
    run: armBindingWrite,
  },
  {
    id: 'bind-image',
    options: {
      composition: 'binding-post-gap-1',
      bindings: [{ toolBindingIdentity: FS_CONTRACT_BINDINGS.readImage, read: ['bound'], write: ['bound'] }],
    },
    run: armBindingReadImage,
  },
  { id: 'edit-ambiguous', options: { composition: 'route-c' }, run: armEditAmbiguous },
  { id: 'edit-replace-all', options: { composition: 'route-c' }, run: armEditReplaceAll },
  { id: 'read-abort', options: { composition: 'route-c' }, run: armReadStreamAbort },
  {
    id: 'image-route-gate',
    options: { composition: 'post-gap-1', llmModalities: ['text'] },
    run: armImageRouteGateTextOnly,
  },
  {
    id: 'image-route-gate-gap',
    options: { composition: 'route-c', llmModalities: ['text'] },
    run: armImageRouteGateUnderProductRoute,
  },
]

/**
 * `compositionFor` re-runs ONLY the named arm under a different composition.
 * `expectFail` is exact: a missing red and an extra red both fail the control.
 */
const CASES = [
  { id: 'baseline', mutations: {}, expectFail: [] },
  { id: 'M1-drop-version-guard', mutations: { dropVersionGuard: true }, expectFail: ['edit-stale'] },
  {
    id: 'M2-underreport-stat-size',
    mutations: { underreportStatSize: true },
    // Both stream-path arms depend on the routing decision M2 removes.
    expectFail: ['read-boundary', 'read-abort'],
  },
  { id: 'M3-drop-write-signal', mutations: { dropWriteSignal: true }, expectFail: ['write-abort'] },
  { id: 'M4-silent-attachment', mutations: { silentAttachment: true }, expectFail: ['image-allowed'] },
  { id: 'M5-force-replace-if-version', mutations: { forceReplaceIfVersion: true }, expectFail: ['create-new'] },
  { id: 'M6-widen-read-lane', mutations: { widenReadLane: true }, expectFail: ['create-outside-read'] },
  { id: 'M7-drop-write-intent', mutations: { dropWriteIntent: true }, expectFail: ['create-unobserved'] },
  {
    id: 'M8-widen-binding-edit',
    mutations: { widenBindingTool: FS_CONTRACT_BINDINGS.edit },
    expectFail: ['bind-edit'],
  },
  {
    id: 'M9-widen-binding-write',
    mutations: { widenBindingTool: FS_CONTRACT_BINDINGS.write },
    expectFail: ['bind-write'],
  },
  {
    id: 'M10-widen-binding-read-image',
    mutations: { widenBindingTool: FS_CONTRACT_BINDINGS.readImage },
    expectFail: ['bind-image'],
  },
  { id: 'M11-force-replace-all', mutations: { forceReplaceAll: true }, expectFail: ['edit-ambiguous'] },
  {
    id: 'M12-drop-replace-all',
    mutations: { dropReplaceAll: true },
    // The flag is load-bearing in BOTH arms: the replace-all arm's only call,
    // and the ambiguous arm's positive CONTROL half (the same read + the same
    // multi-match file with `replace_all: true`).
    expectFail: ['edit-ambiguous', 'edit-replace-all'],
  },
  { id: 'M13-silent-stream-abort', mutations: { silentStreamAbort: true }, expectFail: ['read-abort'] },
  {
    id: 'M14-text-only-route-claims-image',
    mutations: { textOnlyRouteReportsImage: true },
    // One arm family: the gate must be what refuses under EITHER composition.
    expectFail: ['image-route-gate', 'image-route-gate-gap'],
  },
  {
    id: 'D-post-gap-1-composition',
    mutations: {},
    compositionFor: { 'image-route-c': 'post-gap-1' },
    expectFail: ['image-route-c'],
  },
]

async function runArm(arm, { mutations, compositionFor }) {
  const world = await makeFsContractWorld({
    repoRoot: REPO_ROOT,
    label: `mut-${arm.id}`,
    ...arm.options,
    ...(compositionFor?.[arm.id] === undefined ? {} : { composition: compositionFor[arm.id] }),
    mutations,
  })
  try {
    await arm.run(world)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message.split('\n')[0] : String(error) }
  } finally {
    await world.dispose()
  }
}

let failures = 0
const rows = []
for (const testCase of CASES) {
  const observed = []
  const reds = []
  for (const arm of ARMS) {
    const result = await runArm(arm, testCase)
    observed.push({ arm: arm.id, ...result })
    if (!result.ok) reds.push(arm.id)
  }
  const expected = [...testCase.expectFail].sort()
  const actual = [...reds].sort()
  const matches = JSON.stringify(expected) === JSON.stringify(actual)
  if (!matches) failures += 1
  rows.push({ case: testCase.id, expected, actual, matches, observed })
  process.stdout.write(`${matches ? 'PASS' : 'FAIL'} ${testCase.id}: red=[${actual.join(', ')}] expected=[${expected.join(', ')}]\n`)
  for (const entry of observed) {
    if (!entry.ok) process.stdout.write(`       red  ${entry.arm}: ${entry.reason}\n`)
  }
}

process.stdout.write(`\n${failures === 0 ? 'MUTATION-CONTROLS-PASS' : 'MUTATION-CONTROLS-FAIL'} (${CASES.length} controls, ${ARMS.length} arms each)\n`)
if (failures !== 0) process.exitCode = 1
