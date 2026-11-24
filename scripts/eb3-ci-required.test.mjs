/**
 * Host-free negative controls for `scripts/eb3-ci-required.mjs` (TINF trust-closeout, F-01, P0-2).
 *
 * THE DEFECT THESE CONTROL. The leg reader matched a command PREFIX: `node scripts/… --run --leg X`
 * was satisfied by a step that carried any number of undisclosed trailing tokens. Appending `--json`
 * to a dispatched manifest leg therefore kept the static gate green while the step printed a plan and
 * ran nothing. The law is now the WHOLE argv:
 *
 *   - a dispatch leg's manifest cmd must be EXACTLY [node, dispatcher, --run, --leg, <id>];
 *   - every leg's trailing argv must be exactly its `check[]` grammar (token-for-token, `<value>` =
 *     one non-option token), and no `check[]` means no trailing tokens;
 *   - any surplus token is CI_LAYER_LEG_EXTRA_ARGUMENT, fail closed.
 *
 * The controls mutate an in-memory manifest / workflow text (never disk), and the positive half runs
 * the real CLI so "the unmodified tree passes" is asserted, not assumed.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { checkRequiredJobs, checkTrailing, loadManifest, workflowFiles } from './eb3-ci-required.mjs'

const SCRIPT = fileURLToPath(new URL('./eb3-ci-required.mjs', import.meta.url))

/** Every dispatch leg in the real manifest, with a stable pointer for mutation. */
function dispatchLegsOf(manifest) {
  const out = []
  for (const layer of manifest.layers) for (const leg of layer.legs ?? []) if (leg.cmd?.[1] === 'scripts/dispatch-tests.mjs') out.push(leg)
  for (const k of manifest.knownNonRequired ?? []) for (const leg of k.legs ?? []) if (leg.cmd?.[1] === 'scripts/dispatch-tests.mjs') out.push(leg)
  return out
}

const deepClone = (v) => JSON.parse(JSON.stringify(v))

test('eb3-ci-required: the unmodified tree passes from the real CLI (positive control)', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  // The count is the tree's real workflow population, not a literal that drifts silently when a
  // workflow is added: the CLI must grade exactly the files this test reads. The literal below is a
  // deliberate tripwire — adding a workflow must also classify it in dev/ci/eb3-ci-manifest.json
  // (a required layer, or knownNonRequired with a reason), and this assertion forces that review.
  const expected = workflowFiles().size
  assert.equal(expected, 11, 'workflow population changed: classify the new workflow in dev/ci/eb3-ci-manifest.json')
  assert.match(r.stdout, new RegExp(`EB3-CI-REQUIRED pass workflows=${String(expected)} findings=0`))
})

test('eb3-ci-required: a manifest dispatch cmd with an appended --json / --list is EXTRA_ARGUMENT', () => {
  for (const token of ['--json', '--list']) {
    const manifest = deepClone(loadManifest())
    const legs = dispatchLegsOf(manifest)
    assert.ok(legs.length > 0)
    const target = legs.find((l) => l.cmd.includes('tinf-instruments'))
    assert.ok(target, 'the tinf-instruments dispatch leg must exist')
    target.cmd.push(token)
    const { findings } = checkRequiredJobs({ files: workflowFiles(), manifest })
    const hit = findings.filter((f) => f.code === 'CI_LAYER_LEG_EXTRA_ARGUMENT')
    assert.equal(hit.length, 1, `expected exactly one EXTRA_ARGUMENT finding, got ${JSON.stringify(findings)}`)
    assert.match(hit[0].detail, /tinf-instruments/)
    assert.match(hit[0].detail, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('eb3-ci-required: a workflow step that appends --json to a dispatched leg is EXTRA_ARGUMENT', () => {
  const files = workflowFiles()
  const rel = '.github/workflows/ci-integration.yml'
  const before = files.get(rel)
  assert.ok(before.includes('node scripts/dispatch-tests.mjs --run --leg tinf-instruments'))
  files.set(rel, before.replace('node scripts/dispatch-tests.mjs --run --leg tinf-instruments', 'node scripts/dispatch-tests.mjs --run --leg tinf-instruments --json'))
  const { findings } = checkRequiredJobs({ files, manifest: loadManifest() })
  const hit = findings.filter((f) => f.code === 'CI_LAYER_LEG_EXTRA_ARGUMENT')
  assert.equal(hit.length, 1, JSON.stringify(findings))
  assert.match(hit[0].detail, /--json/)
  assert.match(hit[0].detail, /tinf-instruments/)
})

test('eb3-ci-required: checkTrailing is exact in both directions and a value slot cannot absorb an option', () => {
  // no check[] -> nothing may trail
  assert.deepEqual(checkTrailing([], undefined), { extra: [], missing: [] })
  assert.deepEqual(checkTrailing(['--json'], undefined).extra, ['--json'])
  // declared tokens match token-for-token, end-to-end
  assert.deepEqual(checkTrailing(['--check'], ['--check']), { extra: [], missing: [] })
  assert.deepEqual(checkTrailing(['--check', '--json'], ['--check']).extra, ['--json'])
  assert.deepEqual(checkTrailing([], ['--check']).missing, ['--check'])
  // a value slot takes exactly one non-option token
  assert.deepEqual(checkTrailing(['--new-since', '$CI_BASE'], ['--new-since', '<value>']), { extra: [], missing: [] })
  assert.deepEqual(checkTrailing(['--new-since', '--json'], ['--new-since', '<value>']).extra, ['--json'])
  assert.deepEqual(checkTrailing(['--new-since'], ['--new-since', '<value>']).missing, ['<value>'])
})

test('eb3-ci-required: a second --leg on a dispatch cmd is EXTRA_ARGUMENT (not a silent second leg)', () => {
  const manifest = deepClone(loadManifest())
  const target = dispatchLegsOf(manifest).find((l) => l.cmd.includes('tinf-instruments'))
  target.cmd.push('--leg', 'tinf-m0-baseline')
  const { findings } = checkRequiredJobs({ files: workflowFiles(), manifest })
  const hit = findings.filter((f) => f.code === 'CI_LAYER_LEG_EXTRA_ARGUMENT')
  assert.equal(hit.length, 1, JSON.stringify(findings))
  assert.match(hit[0].detail, /tinf-m0-baseline/)
})

test('eb3-ci-required: a declared step argv that disagrees with the manifest leg is STEP_ARGV_DESYNC (both directions)', () => {
  const MANIFEST_ARGV = 'node --test --test-force-exit --test-timeout=900000 --test-reporter=spec tests/world-factory/m7a-real-slice.test.mjs'
  const rel = '.github/workflows/census-runtime.yml'

  // Direction 1: the workflow declaration drifts (the step would record a command nobody grades).
  const files = workflowFiles()
  const before = files.get(rel)
  assert.ok(before.includes(`M7A_STEP_ARGV: '${MANIFEST_ARGV}'`), 'the M7-A step must declare its argv')
  files.set(rel, before.replace(`M7A_STEP_ARGV: '${MANIFEST_ARGV}'`, `M7A_STEP_ARGV: '${MANIFEST_ARGV.replace('--test-timeout=900000', '--test-timeout=800000')}'`))
  const drift = checkRequiredJobs({ files, manifest: loadManifest() }).findings.filter((f) => f.code === 'CI_LAYER_STEP_ARGV_DESYNC')
  assert.equal(drift.length, 1, JSON.stringify(drift))
  assert.match(drift[0].detail, /m7a real-host slice/u)
  assert.match(drift[0].detail, /--test-timeout=800000/u)

  // Direction 2: the manifest leg drifts (the gate would grade a command nobody runs).
  const manifest = deepClone(loadManifest())
  const leg = manifest.layers.flatMap((l) => l.legs ?? []).find((l) => l.id.startsWith('m7a real-host slice'))
  assert.ok(leg, 'the M7-A leg must exist in the manifest')
  leg.cmd = leg.cmd.map((token) => (token === '--test-force-exit' ? '--test-force-exit_v2' : token))
  const drift2 = checkRequiredJobs({ files: workflowFiles(), manifest }).findings.filter((f) => f.code === 'CI_LAYER_STEP_ARGV_DESYNC')
  assert.equal(drift2.length, 1, JSON.stringify(drift2))
  assert.match(drift2[0].detail, /--test-force-exit_v2/u)
})
