/**
 * mutations.mjs — the mutation controls for the FS face's layer-B arms.
 *
 * WHY THIS EXISTS. Every contract pinned here is UPSTREAM behaviour that already
 * works, so a plain green run cannot show that an arm is load-bearing: an arm
 * that asserted nothing would also be green. Each control MUTATES one forwarding
 * decision the lane owns and the matrix claims:
 *
 *   M1  dropVersionGuard      the confined `editText` stops forwarding `expected`
 *                             (the observed version) to the real provider.
 *   M2  underreportStatSize   the confined `stat` under-reports the big file's
 *                             size, so the native read buffers instead of streaming.
 *   M3  dropWriteSignal       the confined `writeText` stops forwarding `signal`.
 *   M4  silentAttachment      the attachment store answers without recording, so
 *                             the allowed-image arm must assert the RECORD, not
 *                             the call.
 *   D   post-gap-1            the SAME `read_image` refusal arm over the proposed
 *                             post-GAP-1 composition, where the routed module
 *                             CAN resolve `fs` — so the refusal arm must go red
 *                             (it measures today's gap, not "read_image fails").
 *
 * A control PASSES when exactly the expected arms go red and every other arm
 * stays green. The mutants live on the mounted instance only; no committed file
 * is edited and no upstream source is touched.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-fs-face/mutations.mjs
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  armEditFreshControl,
  armEditStaleConflict,
  armReadImageAllowed,
  armReadImageDenied,
  armReadImageRouteCRefusal,
  armReadSmallControl,
  armReadStreamBoundary,
  armWriteAbort,
  armWriteControl,
  makeFsContractWorld,
} from '../../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')

/** Every arm, the composition it needs, and the world label it runs under. */
const ARMS = [
  { id: 'edit-stale', composition: 'route-c', run: armEditStaleConflict },
  { id: 'edit-fresh', composition: 'route-c', run: armEditFreshControl },
  { id: 'read-boundary', composition: 'route-c', run: armReadStreamBoundary },
  { id: 'read-small', composition: 'route-c', run: armReadSmallControl },
  { id: 'image-route-c', composition: 'route-c', run: armReadImageRouteCRefusal },
  { id: 'image-allowed', composition: 'post-gap-1', run: armReadImageAllowed },
  { id: 'image-denied', composition: 'post-gap-1', run: armReadImageDenied },
  { id: 'write-abort', composition: 'route-c', run: armWriteAbort },
  { id: 'write-control', composition: 'route-c', run: armWriteControl },
]

const CASES = [
  { id: 'baseline', mutations: {}, expectFail: [] },
  { id: 'M1-drop-version-guard', mutations: { dropVersionGuard: true }, expectFail: ['edit-stale'] },
  { id: 'M2-underreport-stat-size', mutations: { underreportStatSize: true }, expectFail: ['read-boundary'] },
  { id: 'M3-drop-write-signal', mutations: { dropWriteSignal: true }, expectFail: ['write-abort'] },
  { id: 'M4-silent-attachment', mutations: { silentAttachment: true }, expectFail: ['image-allowed'] },
  {
    id: 'D-post-gap-1-composition',
    mutations: {},
    compositionOverride: 'post-gap-1',
    expectFail: ['image-route-c'],
  },
]

async function runArm(arm, { mutations, compositionOverride }) {
  const world = await makeFsContractWorld({
    repoRoot: REPO_ROOT,
    label: `mut-${arm.id}`,
    composition: compositionOverride ?? arm.composition,
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
