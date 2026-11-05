/**
 * a5sf-fs-contract.test.mjs — the FS capability face's LAYER B acceptance:
 * the PER-NATIVE-TOOL contract that a shared face-level (layer A) arm cannot
 * cover.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no `tests/homes/**`: every arm is an
 * in-process Cordis root over `mkdtemp` fixtures. The provider is the PINNED
 * baseline's REAL `LocalFileSystem`, the tool module is the PINNED baseline's
 * REAL `@deepseek-ai/dsh-tool-fs`, and the confinement is the PRODUCT seam
 * (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`, route C).
 *
 * THE FOUR CONTRACT PROPERTIES (and what each arm asserts):
 *
 *   FSB-EDIT-1   version/staleness conflict — a stale edit is refused by the
 *                provider's `FS_STALE_VERSION` guard, changes zero bytes, is one
 *                typed error, and consults the admission exactly once. The
 *                CONTROL (FSB-EDIT-2) is a fresh edit that succeeds, so the arm
 *                cannot pass by "edit always fails".
 *   FSB-READ-1   the >10 MiB / streaming boundary — a file that really crosses
 *                `STREAM_MIN_SIZE` is STREAMED (`streamText` once, `readText`
 *                zero), rendered as a byte-capped window with the exact
 *                continuation footer, and the tail never reaches the model. The
 *                CONTROL (FSB-READ-2) is a below-threshold file that BUFFERS.
 *   FSB-IMG-1    `read_image` under the UNPATCHED product route: the routed
 *                definition shadows the preset one and fails CLOSED — zero
 *                provider reads, zero attachment bytes, zero guard facts. This
 *                is the GAP-FS-CONTRACT-1 evidence, NOT a lane refusal.
 *   FSB-IMG-2/3  `read_image`'s attachment contract on the real module + real
 *                confined provider under the proposed post-GAP-1 composition:
 *                allowed = exactly one attachment with real metadata after one
 *                stat + one readBytes; refused = one `stat` deny fact and zero
 *                reads/bytes.
 *   FSB-ABORT-1  cancellation — an abort after the staged bytes are written but
 *                before publication leaves the target byte-identical, removes
 *                the staging dir, is one `FS_ABORTED`, and is never reported as
 *                success. The CONTROL (FSB-ABORT-2) publishes the same write.
 *
 * NOT DUPLICATING LAYER A: no arm here asserts "the lane refused an out-of-lane
 * path" as its conclusion. FSB-IMG-3 uses the lane's refusal only as the
 * ORDERING witness for the attachment/provider side effects it owns. The
 * allow/deny/ceiling/binding arms are `a5sf-member-policy.test.ts`,
 * `a5sf-product-assembly.test.mjs` PA8, `a5sf-tool-axis.test.mjs` TA2/TA3 and
 * the live rows — deliberately not restated here.
 *
 * Run: node --test tests/world-factory/a5sf-fs-contract.test.mjs
 */
import assert from 'node:assert/strict'
import { after } from 'node:test'
import test from 'node:test'
import { dirname } from 'node:path'
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
} from './lib/a5sf-fs-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = dirname(dirname(HERE))

/** Every world this process built, so a teardown leak cannot survive the run. */
const worlds = []
after(async () => {
  for (const world of worlds) await world.dispose()
})

async function withWorld(label, options, body) {
  const world = await makeFsContractWorld({ repoRoot: REPO_ROOT, label, ...options })
  worlds.push(world)
  try {
    await body(world)
  } finally {
    await world.dispose()
    worlds.splice(worlds.indexOf(world), 1)
  }
}

// ---------------------------------------------------------------------------
// 1. edit — version/staleness conflict
// ---------------------------------------------------------------------------

test('FSB-EDIT-1 a stale edit is refused without writing: one FS_STALE_VERSION, zero bytes, one admission fact', async () => {
  await withWorld('edit-stale', { composition: 'route-c' }, armEditStaleConflict)
})

test('FSB-EDIT-2 control: a fresh edit (read → edit, no external change) really writes', async () => {
  await withWorld('edit-fresh', { composition: 'route-c' }, armEditFreshControl)
})

// ---------------------------------------------------------------------------
// 2. read — the >10 MiB / streaming boundary
// ---------------------------------------------------------------------------

test('FSB-READ-1 a file crossing 10 MiB is streamed into an exact byte-capped window, never buffered or refused', async () => {
  await withWorld('read-boundary', { composition: 'route-c' }, armReadStreamBoundary)
})

test('FSB-READ-2 control: a below-threshold file is buffered by the same tool', async () => {
  await withWorld('read-small', { composition: 'route-c' }, armReadSmallControl)
})

// ---------------------------------------------------------------------------
// 3. read_image — lazy attachments
// ---------------------------------------------------------------------------

test('FSB-IMG-1 GAP-FS-CONTRACT-1: routed read_image fails closed — zero provider reads, zero attachment bytes, zero facts', async () => {
  await withWorld('image-route-c', { composition: 'route-c' }, (world) => {
    assert.equal(world.composition, 'route-c')
    return armReadImageRouteCRefusal(world)
  })
})

test('FSB-IMG-2 allowed read_image materialises exactly ONE attachment with the file\'s metadata, after stat → readBytes', async () => {
  await withWorld('image-allowed', { composition: 'post-gap-1' }, armReadImageAllowed)
})

test('FSB-IMG-3 refused read_image is ONE stat deny fact with zero readBytes and zero attachment bytes', async () => {
  await withWorld('image-denied', { composition: 'post-gap-1' }, armReadImageDenied)
})

// ---------------------------------------------------------------------------
// 4. cancellation / abort
// ---------------------------------------------------------------------------

test('FSB-ABORT-1 an aborted write publishes nothing: byte-identical target, no staging residue, FS_ABORTED, not success', async () => {
  await withWorld('write-abort', { composition: 'route-c' }, armWriteAbort)
})

test('FSB-ABORT-2 control: the same write without an abort publishes', async () => {
  await withWorld('write-control', { composition: 'route-c' }, armWriteControl)
})
