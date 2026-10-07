// Mutation harness for the fence wrapper's report-shape control (§7.4 lane
// C-tools+harness, D3 "prove it can fail").
//
// It mutates the report PRODUCER (`scripts/verify-blueprint-version-clean.mjs`,
// `formatReport`) and never the scanner, the classification rules, or the test,
// because the control's whole
// contract is "the report carries what the structured result found". The pristine
// bytes live in ./fence-script-pristine.mjs, restored by `cp` and re-checked against
// ./fence-script-sha.txt. That copy is NOT committed (a second copy of the fence in
// the tree invites "which one is real?"); materialize it first:
//
//   git show 5ea79126:scripts/verify-blueprint-version-clean.mjs \
//     > dev/agent-workflow/evidence/a4-pr7/7-4-hts/scratch/fence-script-pristine.mjs
//
// This lane never uses `git checkout --`.
//
//   node mutate.mjs A      strip `=v<version>` from the FIRST site of every dirty OFFENDING line
//   node mutate.mjs B      drop one dirty PATH from the report's naming (sites stay in the result)
//   node mutate.mjs C      strip the suffix of ONE site whose `L<line>=v<n>` token also
//                          appears on other report lines (the collision probe)
//   node mutate.mjs restore  cp the pristine copy back
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const HERE = new URL('.', import.meta.url).pathname
const REPO = new URL('../../../../../../', import.meta.url).pathname
const TARGET = REPO + 'scripts/verify-blueprint-version-clean.mjs'
const PRISTINE = HERE + 'fence-script-pristine.mjs'
const DROPPED_PATH = 'packages/domain/test/a1-permission-policy.test.ts'
const COLLIDING_PATH = 'packages/domain/test/blueprint-v1-frozen-resume.test.ts'

const ORIG = "lines.push(...groupByPath(result.dirty, (p, ss) => `OFFENDING ${p} :: ${ss.map(where).join(', ')}`))"

const renderExpr = (body) =>
  'lines.push(...groupByPath(result.dirty, (p, ss) => `OFFENDING ${p} :: ${ss.map(' + body + ').join(\', \')}`))'

const MUTATIONS = {
  A: {
    expr: renderExpr('(s, i) => (i === 0 ? `L${String(s.line)}` : where(s))'),
    note: 'A: every dirty OFFENDING line prints its FIRST site as `L<line>` — the `=v<version>` suffix is gone.',
  },
  B: {
    expr: ORIG.replace('groupByPath(result.dirty,', `groupByPath(result.dirty.filter((s) => s.path !== '${DROPPED_PATH}'),`),
    note: `B: the dirty path ${DROPPED_PATH} is dropped from the report's naming; its sites stay in the structured result.`,
  },
  C: {
    expr: renderExpr(`(s) => (p === '${COLLIDING_PATH}' && s.line === 76 ? \`L\${String(s.line)}\` : where(s))`),
    note: `C: only ${COLLIDING_PATH} L76 loses its suffix — a site whose token also appears on other report lines (collision probe).`,
  },
}

const which = process.argv[2]
if (which === 'restore') {
  copyFileSync(PRISTINE, TARGET)
  console.log('restored the pristine fence script by cp; verify with sha256sum against fence-script-sha.txt')
} else {
  const mutation = MUTATIONS[which]
  if (mutation === undefined) throw new Error(`unknown mutation ${String(which)}`)
  const src = readFileSync(PRISTINE, 'utf8')
  if (!src.includes(ORIG)) throw new Error('mutation target line not found in the pristine script — refusing to mutate blindly')
  if (!src.includes(ORIG) || mutation.expr === ORIG) throw new Error('mutation would be a no-op')
  writeFileSync(TARGET, src.replace(ORIG, mutation.expr))
  console.log('MUTATION ' + which + ' applied: ' + mutation.note)
}
