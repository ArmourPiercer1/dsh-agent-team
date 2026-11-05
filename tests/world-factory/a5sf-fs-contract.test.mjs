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
 * HOST-REQUIRED, AND HONEST ABOUT IT. The three entries the arms consume are
 * `lib/` build outputs of the pinned tree (`tests/deepseek-harness-test-use`,
 * gitignored; `lib/` is not committed even in that tree). A hosted
 * `ci-integration` runner provisions NEITHER the tree NOR a build — measured in
 * PR #612: the suite failed its precondition before any arm ran. A hard failure
 * there is the wrong shape for an environment absence, and a silent `t.skip`
 * would let the arms rot. So the file has THREE states, and only one is green:
 *
 *   host ABSENT                    -> DECLARED REFUSAL: one machine-readable
 *                                     `A5SF-FS-CONTRACT-HOST-REFUSED` line and
 *                                     every case registered as SKIPPED (counted
 *                                     as not-run; `pass 0`), never as pass.
 *   host present, an entry missing -> HARD FAILURE (`A5SF-FS-CONTRACT-HOST-INCOMPLETE`):
 *                                     a partial/older host is a pin violation,
 *                                     not an absence.
 *   host present and complete      -> the nine arms RUN and their assertions are
 *                                     the ones in the lib (unchanged).
 *
 * `A5SF_REQUIRE_PINNED_HOST=1` turns the refusal into a hard failure, for a lane
 * that is SUPPOSED to provision the host (the `census-runtime` idiom: a gate that
 * provisions must not share a green with a gate that could not run). The
 * provisioning proposal (pinned checkout + host build, or the three pinned npm
 * packages as devDependencies) is in
 * `dev/agent-workflow/evidence/a5sf-fs-face/README.md` §10.
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
import { existsSync } from 'node:fs'
import test, { after } from 'node:test'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../paths.mjs'
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
  fsContractHostLayout,
  makeFsContractWorld,
} from './lib/a5sf-fs-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = dirname(dirname(HERE))

/**
 * The cases, as data, so the refusal path registers exactly the same number of
 * cases as the real path (a refusal must never undercount what it refused) — and
 * so the answer to "which arms need the host" is this table: ALL of them.
 */
const CASES = [
  {
    title: 'FSB-EDIT-1 a stale edit is refused without writing: one FS_STALE_VERSION, zero bytes, one admission fact',
    label: 'edit-stale',
    options: { composition: 'route-c' },
    run: armEditStaleConflict,
  },
  {
    title: 'FSB-EDIT-2 control: a fresh edit (read → edit, no external change) really writes',
    label: 'edit-fresh',
    options: { composition: 'route-c' },
    run: armEditFreshControl,
  },
  {
    title: 'FSB-READ-1 a file crossing 10 MiB is streamed into an exact byte-capped window, never buffered or refused',
    label: 'read-boundary',
    options: { composition: 'route-c' },
    run: armReadStreamBoundary,
  },
  {
    title: 'FSB-READ-2 control: a below-threshold file is buffered by the same tool',
    label: 'read-small',
    options: { composition: 'route-c' },
    run: armReadSmallControl,
  },
  {
    title: 'FSB-IMG-1 GAP-FS-CONTRACT-1: routed read_image fails closed — zero provider reads, zero attachment bytes, zero facts',
    label: 'image-route-c',
    options: { composition: 'route-c' },
    run: (world) => {
      if (world.composition !== 'route-c') {
        throw new Error(`FSB-IMG-1 requires composition 'route-c', got '${world.composition}'`)
      }
      return armReadImageRouteCRefusal(world)
    },
  },
  {
    title: "FSB-IMG-2 allowed read_image materialises exactly ONE attachment with the file's metadata, after stat → readBytes",
    label: 'image-allowed',
    options: { composition: 'post-gap-1' },
    run: armReadImageAllowed,
  },
  {
    title: 'FSB-IMG-3 refused read_image is ONE stat deny fact with zero readBytes and zero attachment bytes',
    label: 'image-denied',
    options: { composition: 'post-gap-1' },
    run: armReadImageDenied,
  },
  {
    title: 'FSB-ABORT-1 an aborted write publishes nothing: byte-identical target, no staging residue, FS_ABORTED, not success',
    label: 'write-abort',
    options: { composition: 'route-c' },
    run: armWriteAbort,
  },
  {
    title: 'FSB-ABORT-2 control: the same write without an abort publishes',
    label: 'write-control',
    options: { composition: 'route-c' },
    run: armWriteControl,
  },
]

const HOST = fsContractHostLayout(REPO_ROOT)
const HOST_PRESENT = existsSync(HOST.root)
const MISSING_ENTRIES = Object.entries(HOST.entries).filter(([, path]) => !existsSync(path))
const REQUIRE_HOST = process.env.A5SF_REQUIRE_PINNED_HOST === '1'
const REFUSAL_TOKEN = 'A5SF-FS-CONTRACT-HOST-REFUSED'

/** One line, key=value, greppable: what a hosted runner prints instead of arm results. */
const REFUSAL = [
  REFUSAL_TOKEN,
  'schema=a5sf-host-refusal/1',
  'refused=1',
  `skipped=${CASES.length}`,
  `cases=${CASES.length}`,
  'verdict=NOT_RUN',
  `pinned=${TEST_USE_BASELINE_SHA}`,
  `baseline=${DSH_BASELINE_VERSION}`,
  `path=${HOST.root}`,
  'reason=pinned-host-not-provisioned',
].join(' ')

if (!HOST_PRESENT) {
  // DECLARED, never silent. If the lane is supposed to provide the host, absence
  // is a failure of THAT lane — the census-runtime idiom.
  if (REQUIRE_HOST) {
    throw new Error(
      `A5SF-FS-CONTRACT-HOST-INCOMPLETE: A5SF_REQUIRE_PINNED_HOST=1 but the pinned host is absent at ${HOST.root} — ` +
      `provision tests/deepseek-harness-test-use at ${TEST_USE_BASELINE_SHA} (${DSH_BASELINE_VERSION}) and build it, ` +
      'or unset A5SF_REQUIRE_PINNED_HOST to accept the declared refusal',
    )
  }
  process.stdout.write(`${REFUSAL}\n`)
  for (const testCase of CASES) {
    test(`${testCase.title} — REFUSED (pinned host not provisioned)`, (t) => {
      t.skip(
        `A5SF host requirement: ${testCase.label} needs the pinned baseline's built lib/ entries ` +
        `(${Object.values(HOST.entries).join(', ')}). ${REFUSAL}`,
      )
    })
  }
} else if (MISSING_ENTRIES.length > 0) {
  // PRESENT-BUT-DIFFERENT is not an absence: fail, do not refuse.
  throw new Error(
    'A5SF-FS-CONTRACT-HOST-INCOMPLETE: the pinned host tree exists at ' +
    `${HOST.root} but is missing ${MISSING_ENTRIES.map(([name, path]) => `${name}=${path}`).join(', ')} — ` +
    `a partial or older host is a pin violation (expected ${TEST_USE_BASELINE_SHA} / ${DSH_BASELINE_VERSION}, built)`,
  )
} else {
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

  for (const testCase of CASES) {
    test(testCase.title, () => withWorld(testCase.label, testCase.options, testCase.run))
  }
}
