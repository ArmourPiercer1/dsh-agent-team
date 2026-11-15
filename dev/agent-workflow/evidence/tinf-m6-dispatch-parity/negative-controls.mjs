// One-off negative controls for the M6 laws. Not committed as a test (the checker's own suite would
// have to import `yaml`); the output is recorded in the M6 evidence file instead.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { checkRequiredJobs } from '../../../../scripts/eb3-ci-required.mjs'

const root = `${process.cwd()}/`  // run from the repo root
const files = new Map()
for (const f of readdirSync(join(root, '.github/workflows'))) {
  files.set(`.github/workflows/${f}`, readFileSync(join(root, '.github/workflows', f), 'utf8'))
}
const base = JSON.parse(readFileSync(join(root, 'dev/ci/eb3-ci-manifest.json'), 'utf8'))
const clone = () => JSON.parse(JSON.stringify(base))
const legOf = (m, id) => m.layers.flatMap((l) => l.legs ?? []).find((x) => x.dispatch_id === id)
const codes = (m) => [...new Set(checkRequiredJobs({ files, manifest: m }).findings.map((f) => f.code))]

const cases = []
let m = clone(); delete legOf(m, 'tinf-instruments').suites; cases.push(['a dispatch leg with no population', 'CI_LAYER_LEG_NO_SUITES', m])
m = clone(); legOf(m, 'tinf-instruments').suites[0] = 'scripts/not-a-real-suite.test.mjs'; cases.push(['a declared suite that does not exist', 'CI_SUITE_ABSENT', m])
m = clone(); legOf(m, 'tests-checks').areas = ['tests/no-such-area']; delete legOf(m, 'tests-checks').suites; cases.push(['an area that does not exist', 'CI_SUITE_AREA_ABSENT', m])
m = clone(); legOf(m, 'tinf-m0-baseline').cmd = ['node', 'scripts/dispatch-tests.mjs', '--leg', 'tinf-m0-baseline']; cases.push(['a dispatch cmd without --run', 'CI_LAYER_LEG_DISPATCH_SHAPE', m])
m = clone(); legOf(m, 'tinf-m0-baseline').cmd = ['node', 'scripts/dispatch-tests.mjs', '--run', '--leg', 'tinf-m0-baseline', '--run']; cases.push(['a dispatch cmd ending in the shared token', 'CI_LAYER_LEG_DISPATCH_SHAPE', m])
m = clone(); legOf(m, 'tinf-m0-baseline').dispatch_id = 'some-other-leg'; cases.push(['dispatch_id disagreeing with --leg', 'CI_LAYER_LEG_DISPATCH_ID', m])
m = clone(); legOf(m, 'tinf-m0-baseline').suites = [' scripts/tinf-m0.test.mjs ']; cases.push(['a padded suite path is refused (not silently trimmed)', 'CI_SUITE_ABSENT', m])
m = clone(); legOf(m, 'tinf-m0-baseline').suites = ['  ']; cases.push(['a blank suite', 'CI_LAYER_LEG_SUITE_INVALID', m])
m = clone(); m.knownNonRequired.find((k) => k.job === 'settlement').legs[0].suites = ['scripts/gone.test.mjs']; cases.push(['the settlement job leg is graded too', 'CI_SUITE_ABSENT', m])

let bad = 0
for (const [label, want, manifest] of cases) {
  const got = codes(manifest)
  const ok = want === null ? got.length === 0 : got.includes(want)
  if (!ok) bad += 1
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${want ? ` -> ${want}` : ''}${ok ? '' : ` got ${JSON.stringify(got)}`}`)
}
const baseFindings = checkRequiredJobs({ files, manifest: base }).findings
console.log(`  ${baseFindings.length === 0 ? 'ok  ' : 'FAIL'} positive control: the unmodified manifest has 0 findings`)
console.log(`DSH-M6-NEGATIVE-CONTROLS ${bad === 0 && baseFindings.length === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}`)
process.exit(bad === 0 && baseFindings.length === 0 ? 0 : 1)
