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

// ── THE VERSION GATE'S CLASSIFICATION IS ASSERTED, IN BOTH DIRECTIONS (owner ruling 2026-11-25).
// `candidate-acceptance` is a VERSION gate: required at a frozen candidate SHA, never a per-PR
// required context. These controls prove the gate reds if that sentence is removed OR if the workflow
// is promoted into a required layer — the two ways the ruling could be silently undone.
test('eb3-ci-required: the version-gate classification is PRESENT and exact on the real manifest', () => {
  const findings = checkRequiredJobs({ files: workflowFiles(), manifest: loadManifest() }).findings
    .filter((f) => f.code.startsWith('CI_VERSION_GATE_'))
  assert.deepEqual(findings, [], `the real tree must carry the classification: ${JSON.stringify(findings)}`)
})

test('eb3-ci-required: removing the classification is CI_VERSION_GATE_CLASSIFICATION_MISSING', () => {
  const manifest = deepClone(loadManifest())
  const entry = manifest.knownNonRequired.find((k) => k.job === 'candidate-acceptance' && k.workflow.endsWith('candidate-acceptance.yml'))
  assert.ok(entry, 'the candidate-acceptance declaration must exist')
  delete entry.classification
  const hit = checkRequiredJobs({ files: workflowFiles(), manifest }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_CLASSIFICATION_MISSING')
  assert.equal(hit.length, 1, JSON.stringify(hit))
  assert.match(hit[0].detail, /candidate-acceptance/)
})

test('eb3-ci-required: relaxing requiredPerPR to true is CI_VERSION_GATE_CLASSIFICATION_MISSING', () => {
  const manifest = deepClone(loadManifest())
  const entry = manifest.knownNonRequired.find((k) => k.job === 'version-gate' && k.workflow.endsWith('candidate-acceptance.yml'))
  assert.ok(entry, 'the stable version-gate context must be declared')
  entry.requiredPerPR = true
  const hit = checkRequiredJobs({ files: workflowFiles(), manifest }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_CLASSIFICATION_MISSING')
  assert.equal(hit.length, 1, JSON.stringify(hit))
  assert.match(hit[0].detail, /requiredPerPR=true/)
})

test('eb3-ci-required: deleting the stable version-gate job entry is CI_VERSION_GATE_CONTEXT_MISSING', () => {
  const manifest = deepClone(loadManifest())
  manifest.knownNonRequired = manifest.knownNonRequired.filter((k) => !(k.workflow.endsWith('candidate-acceptance.yml') && k.job === 'version-gate'))
  const hit = checkRequiredJobs({ files: workflowFiles(), manifest }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_CONTEXT_MISSING')
  assert.equal(hit.length, 1, JSON.stringify(hit))
})

test('eb3-ci-required: adding the version gate to a required layer is CI_VERSION_GATE_PROMOTED_TO_REQUIRED', () => {
  // Direction A: the workflow becomes a layer.
  const manifestA = deepClone(loadManifest())
  manifestA.layers.push({
    id: 'ci-version-gate',
    workflow: '.github/workflows/candidate-acceptance.yml',
    job: 'candidate-acceptance',
    legs: [{ id: 'candidate-acceptance-gate', cmd: ['node', 'scripts/candidate-acceptance-gate.mjs'], check: ['--hosts', 'both'] }],
  })
  const hitA = checkRequiredJobs({ files: workflowFiles(), manifest: manifestA }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_PROMOTED_TO_REQUIRED')
  assert.ok(hitA.length >= 1, JSON.stringify(hitA))

  // Direction B: a required layer leg runs the version gate's scripts without naming the workflow.
  const manifestB = deepClone(loadManifest())
  manifestB.layers[0].legs.push({ id: 'smuggled-version-gate', cmd: ['node', 'scripts/version-gate-verify.mjs'], check: [] })
  const hitB = checkRequiredJobs({ files: workflowFiles(), manifest: manifestB }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_PROMOTED_TO_REQUIRED')
  assert.equal(hitB.length, 1, JSON.stringify(hitB))
  assert.match(hitB[0].detail, /version-gate-verify/)
})

test('eb3-ci-required: removing the PR label gate makes the 84 min run every-PR (CI_VERSION_GATE_PR_PATH_UNGATED)', () => {
  const files = workflowFiles()
  const rel = '.github/workflows/candidate-acceptance.yml'
  const before = files.get(rel)
  const labelTest = "contains(github.event.pull_request.labels.*.name, 'candidate-acceptance')"
  assert.ok(before.includes(labelTest), 'the label gate must exist in the workflow')
  // Replace the durable label-presence test with a plain PR trigger: the exact regression the ruling forbids.
  files.set(rel, before.replace(labelTest, "github.event_name == 'pull_request'"))
  const hit = checkRequiredJobs({ files, manifest: loadManifest() }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_PR_PATH_UNGATED')
  assert.equal(hit.length, 1, JSON.stringify(hit))
})

// ── ROUND 127: the stable context must DEPEND on the grading job's success, and the graded head must
// be bound to the triggering commit. Each control removes exactly one fact from the real workflow.
test('eb3-ci-required: removing the version-gate needs edge is CI_VERSION_GATE_NEEDS_MISSING', () => {
  const files = workflowFiles()
  const rel = '.github/workflows/candidate-acceptance.yml'
  const before = files.get(rel)
  const edge = '    needs: candidate-acceptance\n'
  assert.ok(before.includes(edge), 'the stable job must declare the needs edge')
  files.set(rel, before.replace(edge, ''))
  const hit = checkRequiredJobs({ files, manifest: loadManifest() }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_NEEDS_MISSING')
  assert.equal(hit.length, 1, JSON.stringify(hit))
  assert.match(hit[0].detail, /candidate-acceptance/)
})

test('eb3-ci-required: removing the explicit grading-success guard is CI_VERSION_GATE_GRADING_SUCCESS_UNGUARDED', () => {
  const files = workflowFiles()
  const rel = '.github/workflows/candidate-acceptance.yml'
  const before = files.get(rel)
  assert.ok(before.includes('GRADING_NOT_SUCCESS'), 'the success guard must exist')
  // Keep `needs` and `always()`: only the explicit success check disappears — the exact
  // skipped-green shape the owner forbade.
  files.set(rel, before.replaceAll('needs.candidate-acceptance.result', 'needs.candidate-acceptance.outcome').replaceAll('GRADING_NOT_SUCCESS', 'GRADING_MAYBE'))
  const hit = checkRequiredJobs({ files, manifest: loadManifest() }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_GRADING_SUCCESS_UNGUARDED')
  assert.equal(hit.length, 1, JSON.stringify(hit))
  assert.match(hit[0].detail, /always\(\)/)
})

test('eb3-ci-required: dropping the SHA-binding script invocation is CI_VERSION_GATE_SHA_BINDING_MISSING', () => {
  const files = workflowFiles()
  const rel = '.github/workflows/candidate-acceptance.yml'
  const before = files.get(rel)
  assert.ok(before.includes('scripts/version-gate-head-binding.mjs'), 'the binding script must be executed')
  files.set(rel, before.replaceAll('scripts/version-gate-head-binding.mjs', 'scripts/not-the-binding.mjs'))
  const hit = checkRequiredJobs({ files, manifest: loadManifest() }).findings
    .filter((f) => f.code === 'CI_VERSION_GATE_SHA_BINDING_MISSING')
  assert.equal(hit.length, 1, JSON.stringify(hit))
  assert.match(hit[0].detail, /graded head/)
})
