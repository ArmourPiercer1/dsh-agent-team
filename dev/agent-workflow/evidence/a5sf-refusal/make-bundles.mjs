/**
 * make-bundles.mjs — emit the negative controls for the 2026-11-08 refusal
 * preflight change, from the ONE truthful BL-18 plan.
 *
 * WHY DERIVED, NOT HAND-WRITTEN. Each control must turn EXACTLY ONE check red.
 * Deriving every control from `bl18-after.bundle.json` (which PASSes 18/18)
 * makes that property mechanical: the only difference is the defect named in
 * the file name, so a reviewer can diff the control against the plan.
 *
 * USAGE
 *   node dev/agent-workflow/evidence/a5sf-refusal/make-bundles.mjs
 *
 * @module dev/agent-workflow/evidence/a5sf-refusal/make-bundles
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'negative-controls')
const PLAN = JSON.parse(readFileSync(join(HERE, 'bl18-after.bundle.json'), 'utf8'))

const clone = (fn) => {
  const copy = structuredClone(PLAN)
  fn(copy)
  return `${JSON.stringify(copy, null, 1)}\n`
}

const controls = {
  // `policy.paths`: the class is declared but one observable is absent. The
  // contract says FAIL (never UNKNOWN) — the whole point is a decidable verdict.
  'admission-refusal-incomplete.bundle.json': clone((b) => {
    b.label = 'NEGATIVE CONTROL (not the plan): admission-refusal class with providerEntries absent'
    delete b.cases[0].providerEntries
  }),
  // `policy.paths`: the class tries to buy a confinement claim. `true` is
  // rejected exactly like silence (the plan carries an explicit false).
  'admission-refusal-confinement-claim.bundle.json': clone((b) => {
    b.label = 'NEGATIVE CONTROL (not the plan): admission-refusal case claimsConfinement=true'
    b.cases[0].claimsConfinement = true
  }),
  // `driver.caller-surface`: the strict-Member web caller BL-18 readiness ruled
  // out — surfaced ⇒ A2C-2 fatal; denied ⇒ route-C refuses to ADD.
  'strict-member-caller.bundle.json': clone((b) => {
    b.label = 'NEGATIVE CONTROL (not the plan): strict-Member web caller'
    b.driver.caller.strict = true
  }),
  // `bundle.case-coverage`: the driver's own manifest declares a case the
  // bundle never tables. This is the BL-17 hole in a one-line mutation.
  'bundle-case-undeclared.bundle.json': clone((b) => {
    b.label = 'NEGATIVE CONTROL (not the plan): driver manifest declares an untabled case'
    b.driver.caseManifest = { cases: ['web-transport-deny'] }
  }),
}

for (const [name, text] of Object.entries(controls)) writeFileSync(join(OUT, name), text)
process.stdout.write(`wrote ${String(Object.keys(controls).length)} controls to ${OUT}\n`)
