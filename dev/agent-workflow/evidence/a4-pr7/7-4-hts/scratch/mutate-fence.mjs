// Mutation harness for the fence wrapper's report-shape control (§7.4 lane
// C-tools+harness, D3 "prove it can fail"; extended after the reviewer's
// MERGE-with-fixes round).
//
// It mutates the report PRODUCER (`scripts/verify-blueprint-version-clean.mjs`) and
// never the scanner's classification rules, never the wrapper, never a version
// constant or scope list. The contract under test is "the report the gate consumes
// carries exactly what the structured result found", so every mutation here is a defect
// in how a finding is RENDERED: a stripped suffix, a dropped path, a phantom site, a
// duplicated site, a truncated artifact, an off-by-one tally, a reordering.
//
// The pristine bytes live in ./fence-script-pristine.mjs, restored by `cp` and
// re-checked against ./fence-script-sha.txt. That copy is NOT committed (a second copy
// of the fence in the tree invites "which one is real?"); materialize it first:
//
//   git show 5ea79126:scripts/verify-blueprint-version-clean.mjs \
//     > dev/agent-workflow/evidence/a4-pr7/7-4-hts/scratch/fence-script-pristine.mjs
//
// This lane never uses `git checkout --`.
//
// Usage:
//   node mutate-fence.mjs <id>       apply one mutation, print the first dirty line
//   node mutate-fence.mjs restore    cp the pristine copy back
//
// Holes — each must redden a sharp control:
//   A  the FIRST site of every dirty OFFENDING line loses its `=v<version>` suffix
//   B  one dirty PATH disappears from the naming (its sites stay in the result)
//   C  ONE site whose token also occurs on another report line loses its suffix
//   E  a PHANTOM site is printed for every dirty path — in the report, not in the result
//   F  one site is printed TWICE on its own path's line
//   D  the CLI TRUNCATES long OFFENDING lines on stdout while `formatReport` still
//      returns them whole: the artifact lies and the library does not. Invisible to any
//      control that formats the report itself instead of reading what the gate reads.
//   G  the `RESULT dirty(...)` tally under-reports its SITE count by one
//
// By-design GREENS — a control that reddens these is over-fitting, not sharper:
//   I  a path's sites print in REVERSE order: the contract is the multiset per path,
//      not the order along the line
//   J  the PROSE class reorders its own tokens: this leg's subject is dirty sites;
//      prose is another leg's business and is not gated at all
//
// SURGICAL BY CONSTRUCTION, and that is a hard-won clause. Every dirty-line mutation
// goes through `offending()`, which keeps `ss.map(...)` and the `.join(', ')` intact and
// changes only the per-site token. The first version of this harness interpolated a bare
// expression and dropped the join, so mutation A did not strip a suffix — it printed an
// arrow function's source where the sites used to be. Every hole still reddened the
// control, for the wrong reason, which is the only kind of reason that makes a mutation
// table worthless. What exposed it was mutation I: the expected-GREEN is the harness's
// own test, and no mangled line can pass it. `--show` therefore prints the first dirty
// OFFENDING line after each apply, so a transcript proves the SHAPE of a defect instead
// of asserting it.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'


const HERE = new URL('.', import.meta.url).pathname
const REPO = new URL('../../../../../../', import.meta.url).pathname
const TARGET = REPO + 'scripts/verify-blueprint-version-clean.mjs'
const PRISTINE = HERE + 'fence-script-pristine.mjs'

const B = '`' // a backtick, so the fragments below stay readable

// Anchors are the producer's own source lines, written literally (a double-quoted JS
// string keeps both the backticks and `${` intact). The harness refuses to apply when
// an anchor is absent, so a stale anchor is a hard error rather than a silent no-op —
// that check has already caught two of my own broken anchors in this round.
const DIRTY_LINE =
  "lines.push(...groupByPath(result.dirty, (p, ss) => `OFFENDING ${p} :: ${ss.map(where).join(', ')}`))"
const PROSE_LINE =
  "lines.push(...groupByPath(result.prose, (p, ss) => `PROSE ${p} :: ${ss.map(where).join(', ')}`))"
const WRITE_LINE = 'process.stdout.write(`${formatReport(result)}\\n`)'
const TALLY_DIRTY = 'lines.push(`RESULT dirty(${tally(result.dirty)})`)'

const DROPPED_PATH = 'packages/domain/test/a1-permission-policy.test.ts'
const COLLIDING_PATH = 'packages/domain/test/blueprint-v1-frozen-resume.test.ts'
const DUPLICATED_PATH = 'cordis.patch.yml'

/** A dirty OFFENDING line rendering every site through `inner`; join and shape kept. */
const offending = (inner) =>
  "lines.push(...groupByPath(result.dirty, (p, ss) => `OFFENDING ${p} :: ${ss.map(" +
  inner +
  ").join(', ')}`))"

/** A dirty OFFENDING line whose whole token list is `list`; join and shape kept. */
const offendingList = (list) =>
  "lines.push(...groupByPath(result.dirty, (p, ss) => `OFFENDING ${p} :: ${" +
  list +
  ".join(', ')}`))"

const MUTATIONS = {
  A: {
    anchor: DIRTY_LINE,
    expr: offending('(s, i) => (i === 0 ? `L${String(s.line)}` : where(s))'),
    expect: 'red',
    note: 'every dirty line prints its FIRST site as `L<line>` — the `=v<version>` is gone',
  },
  B: {
    anchor: DIRTY_LINE,
    expr:
      "lines.push(...groupByPath(result.dirty.filter((s) => s.path !== '" +
      DROPPED_PATH +
      "'), (p, ss) => `OFFENDING ${p} :: ${ss.map(where).join(', ')}`))",
    expect: 'red',
    note: DROPPED_PATH + ' disappears from the naming while its sites stay in the result',
  },
  C: {
    anchor: DIRTY_LINE,
    expr: offending(
      "(s) => (p === '" + COLLIDING_PATH + "' && s.line === 76 ? `L${String(s.line)}` : where(s))",
    ),
    expect: 'red',
    note: COLLIDING_PATH + ' L76 alone loses its suffix — a token that also occurs elsewhere',
  },
  E: {
    anchor: DIRTY_LINE,
    expr: offendingList('[...ss.map(where), `L99999=v1`]'),
    expect: 'red',
    note: 'a PHANTOM site `L99999=v1` is appended to every dirty path: printed, never found',
  },
  F: {
    anchor: DIRTY_LINE,
    expr: offendingList(
      // parenthesised: `.join` would otherwise bind to the false branch only, and the
      // mutated line would differ in its delimiter as well as in its duplicate
      "(" + "p === '" + DUPLICATED_PATH + "' ? [...ss.map(where), where(ss[0])] : ss.map(where))",
    ),
    expect: 'red',
    note: 'the first site of ' + DUPLICATED_PATH + ' is printed TWICE on its own line',
  },
  D: {
    anchor: WRITE_LINE,
    expr:
      "process.stdout.write(formatReport(result).split('\\n').map((l) => (l.startsWith('OFFENDING ') && l.length > 80 ? `${l.slice(0, 80)}…[truncated]` : l)).join('\\n') + '\\n')",
    expect: 'red',
    note: 'the CLI truncates long OFFENDING lines on stdout; the returned string stays whole',
  },
  G: {
    anchor: TALLY_DIRTY,
    expr:
      'lines.push(`RESULT dirty(${String(new Set(result.dirty.map((s) => s.path)).size)} files, ${String(result.dirty.length - 1)} sites)`)',
    expect: 'red',
    note: 'the dirty tally under-reports its SITE count by one (file count untouched)',
  },
  I: {
    anchor: DIRTY_LINE,
    expr: offendingList('[...ss.map(where)].reverse()'),
    expect: 'green',
    note: 'BY DESIGN: a path prints its sites in reverse order — order on the line is not the contract',
  },
  J: {
    anchor: PROSE_LINE,
    expr:
      "lines.push(...groupByPath(result.prose, (p, ss) => `PROSE ${p} :: ${[...ss.map(where)].reverse().join(', ')}`))",
    expect: 'green',
    note: 'BY DESIGN: PROSE reorders its own tokens — prose is another leg and is not gated',
  },
}

const which = process.argv[2]
if (which === 'restore') {
  copyFileSync(PRISTINE, TARGET)
  console.log('restored the pristine fence script by cp; verify it against fence-script-sha.txt')
} else {
  const mutation = MUTATIONS[which]
  if (mutation === undefined) {
    console.error('unknown mutation; known: ' + Object.keys(MUTATIONS).join(', '))
    process.exit(64)
  }
  const src = readFileSync(PRISTINE, 'utf8')
  if (!src.includes(mutation.anchor)) {
    throw new Error('anchor not found in the pristine script — refusing to mutate blindly: ' + which)
  }
  if (mutation.expr === mutation.anchor) throw new Error('mutation would be a no-op: ' + which)
  const mutated = src.replace(mutation.anchor, mutation.expr)
  writeFileSync(TARGET, mutated)
  // A mutation that does not parse is a defect in the harness, not in the report:
  // check it here, where the failure is loud, rather than letting vitest report an
  // import error that looks like a control result.
  try {
    execSync('node --check ' + JSON.stringify(TARGET), { stdio: 'pipe' })
  } catch (error) {
    copyFileSync(PRISTINE, TARGET)
    throw new Error(
      'MUTATION ' + which + ' does not parse; restored.\n' + String(error.stderr ?? error),
    )
  }
  console.log('MUTATION ' + which + ' (expect ' + mutation.expect + '): ' + mutation.note)
  // Prove the shape, don't assert it: what the mutated producer actually prints first.
  try {
    const out = execSync('node ' + JSON.stringify(TARGET) + ' 2>&1 || true', { encoding: 'utf8' })
    const first = out.split('\n').find((l) => l.startsWith('OFFENDING ')) ?? '(no OFFENDING line)'
    const tally = out.split('\n').find((l) => l.startsWith('RESULT dirty(')) ?? '(no tally line)'
    console.log('  first dirty line : ' + first.slice(0, 120))
    console.log('  tally line       : ' + tally)
  } catch (error) {
    console.log('  (producer would not run: ' + String(error) + ')')
  }
}
