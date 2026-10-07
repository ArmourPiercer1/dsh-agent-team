// Mutation harness for the fence wrapper's report-shape control (§7.4 lane
// C-tools+harness; extended across the reviewer's MERGE-with-fixes round and the
// `73ffd06c` re-derive).
//
// It mutates the report PRODUCER (`scripts/verify-blueprint-version-clean.mjs`) and
// never the scanner's classification rules, never the wrapper, never a version
// constant or scope list. The contract under test is "the report the gate consumes
// carries exactly what the structured result found", so every mutation here is a defect
// in how a finding is RENDERED: a stripped suffix, a dropped path, a phantom site, a
// duplicated site, a truncated artifact, an off-by-one tally, a reordering.
//
// Usage:
//   node mutate-fence.mjs <id>     apply one mutation; print target + resulting shape
//   node mutate-fence.mjs restore  put the committed script back (cp, never git checkout)
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
// ── Three failure modes this harness now structurally refuses ──────────────────────
// 1. A BROKEN ANCHOR. It throws when an anchor is absent instead of applying nothing.
//    That caught two of my own malformed anchors this round; before the check, a run
//    reported "58 passed" against a PRISTINE script and read as a green under mutation.
// 2. A MANGLED MUTATION. Every dirty-line mutation goes through `offending()`, which
//    keeps `ss.map(...)` and the `.join(', ')` intact and changes only the per-site
//    token. The first version interpolated a bare expression and dropped the join, so
//    mutation A printed an ARROW FUNCTION'S SOURCE where the sites used to be: every
//    hole still reddened the control, for the wrong reason. `node --check` on the
//    mutated producer and the expected-GREENs are the guards — the expected-green is the
//    harness's own test, because no mangled line can pass it.
// 3. A VACUOUS TARGET — found on the `73ffd06c` re-derive, not before. B and C named
//    specific dirty paths; another lane migrated those files, so both mutations applied
//    text that matched NOTHING and the wrapper reported 58/58 as though the control had
//    been probed. Data drift is the same lie as anchor drift. Now: every target is
//    RESOLVED FROM THE LIVE DIRTY SET before applying, a target that is not dirty is a
//    hard error, and after applying the harness runs the mutated producer and THROWS if
//    its report is byte-identical to the pristine one. A mutation that changes nothing
//    must not be allowed to print a result.
//
// The pristine base is the COMMITTED blob (`git show HEAD:scripts/…`), materialized to
// ./fence-script-pristine.mjs, so the harness cannot mutate a stale copy after upstream
// edits the producer; the sha it mutated is printed on every run.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const HERE = new URL('.', import.meta.url).pathname
const REPO = new URL('../../../../../../', import.meta.url).pathname
const REL = 'scripts/verify-blueprint-version-clean.mjs'
const TARGET = REPO + REL
const PRISTINE = HERE + 'fence-script-pristine.mjs'
const SHA_FILE = HERE + 'fence-script-sha.txt'

const sha = (text) => createHash('sha256').update(text).digest('hex')

/** The committed producer, materialized as the pristine base. */
function committedBase() {
  const blob = execSync('git show HEAD:' + REL, {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  writeFileSync(PRISTINE, blob)
  const digest = sha(blob)
  const recorded = existsSync(SHA_FILE) ? readFileSync(SHA_FILE, 'utf8').trim().split(' ')[0] : ''
  const note =
    recorded === ''
      ? ''
      : recorded === digest
        ? ', matches fence-script-sha.txt'
        : '; NOTE: upstream has edited the producer since that record'
  console.log('  pristine base  : sha256 ' + digest.slice(0, 16) + '… (HEAD blob' + note + ')')
  return blob
}

/** What the gate would read on stdout (the fence exits 1 while dirty, so catch). */
function reportOf(path) {
  try {
    return execSync('node ' + JSON.stringify(path) + ' 2>&1', {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    return String(error.stdout ?? '')
  }
}

/** `path -> printed tokens`, parsed exactly as the hardened control leg parses it. */
function parseOffending(report) {
  const printed = new Map()
  for (const line of report.split('\n')) {
    const off = /^OFFENDING (.+?) :: (.*)$/.exec(line)
    const offPath = off?.[1]
    const offSites = off?.[2]
    if (offPath !== undefined && offSites !== undefined) {
      const toks = offSites
        .split(', ')
        .map((t) => t.trim())
        .filter((t) => t !== '')
      printed.set(offPath, [...(printed.get(offPath) ?? []), ...toks])
    }
  }
  return printed
}

/**
 * Resolve every target from the CURRENT dirty set, so the mutations cannot rot into
 * no-ops the way two hardcoded paths did. Deterministic: sorted, first match.
 */
function resolveTargets(report) {
  const printed = parseOffending(report)
  const paths = [...printed.keys()].sort()
  if (paths.length === 0) throw new Error('the pristine report names no dirty path; nothing to attack')
  const sitesOf = (p) => printed.get(p) ?? []
  const multi = paths.filter((p) => sitesOf(p).length >= 2)
  if (multi.length === 0) throw new Error('no dirty path carries two sites; C/F/I are unattackable here')

  // B: a path with >= 2 sites, so the drop is "a path vanishes", not "the shortest line".
  const dropped = multi[0]

  // C: a site whose `L<line>=v<version>` token also occurs under ANOTHER path — the
  // collision is what makes a whole-report `toContain` blind to it (measured at 69 of
  // 253 sites when this was first counted).
  const seen = new Map()
  for (const p of paths) for (const t of sitesOf(p)) seen.set(t, [...(seen.get(t) ?? []), p])
  const collidingToken = [...seen.entries()]
    .filter(([t, ps]) => ps.length >= 2 && /^L\d+=v\d+$/.test(t))
    .sort(([a], [b]) => a.localeCompare(b))[0]
  if (collidingToken === undefined) throw new Error('no colliding site token on this base; C is unattackable')
  const [token, tokenPaths] = collidingToken
  const collidingPath = tokenPaths.filter((p) => sitesOf(p).length >= 2).sort()[0] ?? tokenPaths[0]
  const collidingLine = Number(/^L(\d+)=v\d+$/.exec(token)?.[1])
  if (!Number.isFinite(collidingLine)) throw new Error('could not parse the colliding token ' + token)

  // F: a multi-site path, preferred stable name so transcripts stay readable across rounds.
  const duplicated = paths.includes('cordis.patch.yml') ? 'cordis.patch.yml' : multi[0]

  return { dropped, collidingPath, collidingLine, collidingToken: token, duplicated, pathCount: paths.length }
}

const DIRTY_LINE =
  "lines.push(...groupByPath(result.dirty, (p, ss) => `OFFENDING ${p} :: ${ss.map(where).join(', ')}`))"
const PROSE_LINE =
  "lines.push(...groupByPath(result.prose, (p, ss) => `PROSE ${p} :: ${ss.map(where).join(', ')}`))"
const WRITE_LINE = 'process.stdout.write(`${formatReport(result)}\\n`)'
const TALLY_DIRTY = 'lines.push(`RESULT dirty(${tally(result.dirty)})`)'

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

/** id -> { anchor, expr(t), expect, note(t) } */
const MUTATIONS = {
  A: {
    anchor: DIRTY_LINE,
    expr: () => offending('(s, i) => (i === 0 ? `L${String(s.line)}` : where(s))'),
    expect: 'red',
    note: () => 'every dirty line prints its FIRST site as `L<line>` — the `=v<version>` is gone',
  },
  B: {
    anchor: DIRTY_LINE,
    expr: (t) =>
      "lines.push(...groupByPath(result.dirty.filter((s) => s.path !== '" +
      t.dropped +
      "'), (p, ss) => `OFFENDING ${p} :: ${ss.map(where).join(', ')}`))",
    expect: 'red',
    note: (t) => t.dropped + ' disappears from the naming while its sites stay in the result',
  },
  C: {
    anchor: DIRTY_LINE,
    expr: (t) =>
      offending(
        "(s) => (p === '" +
          t.collidingPath +
          "' && s.line === " +
          String(t.collidingLine) +
          ' ? `L${String(s.line)}` : where(s))',
      ),
    expect: 'red',
    note: (t) =>
      t.collidingPath +
      ' L' +
      String(t.collidingLine) +
      " alone loses its suffix — the token `" +
      t.collidingToken +
      '` also occurs elsewhere, so a whole-report search is blind to it',
  },
  E: {
    anchor: DIRTY_LINE,
    expr: () => offendingList('[...ss.map(where), `L99999=v1`]'),
    expect: 'red',
    note: () => 'a PHANTOM site `L99999=v1` is appended to every dirty path: printed, never found',
  },
  F: {
    anchor: DIRTY_LINE,
    expr: (t) =>
      offendingList(
        // parenthesised: `.join` would otherwise bind to the false branch only, and the
        // mutated line would then differ in its delimiter as well as in its duplicate
        "(" + "p === '" + t.duplicated + "' ? [...ss.map(where), where(ss[0])] : ss.map(where))",
      ),
    expect: 'red',
    note: (t) => 'the first site of ' + t.duplicated + ' is printed TWICE on its own line',
  },
  D: {
    anchor: WRITE_LINE,
    expr: () =>
      "process.stdout.write(formatReport(result).split('\\n').map((l) => (l.startsWith('OFFENDING ') && l.length > 80 ? `${l.slice(0, 80)}…[truncated]` : l)).join('\\n') + '\\n')",
    expect: 'red',
    note: () => 'the CLI truncates long OFFENDING lines on stdout; the returned string stays whole',
  },
  G: {
    anchor: TALLY_DIRTY,
    expr: () =>
      'lines.push(`RESULT dirty(${String(new Set(result.dirty.map((s) => s.path)).size)} files, ${String(result.dirty.length - 1)} sites)`)',
    expect: 'red',
    note: () => 'the dirty tally under-reports its SITE count by one (file count untouched)',
  },
  I: {
    anchor: DIRTY_LINE,
    expr: () => offendingList('[...ss.map(where)].reverse()'),
    expect: 'green',
    note: () => 'BY DESIGN: a path prints its sites in reverse order — order is not the contract',
  },
  J: {
    anchor: PROSE_LINE,
    // Reorders the PROSE LINES, not the tokens within a line. It started as a token
    // reversal and the vacuity guard caught it going vacuous on `73ffd06c`: the prose
    // class is `5 files, 5 sites`, so every prose path prints exactly ONE token and
    // reversing one element is byte-identical. Line order is still the same claim — the
    // prose class reorders its output and this leg must not care — and it changes bytes.
    expr: () =>
      "lines.push(...[...groupByPath(result.prose, (p, ss) => `PROSE ${p} :: ${ss.map(where).join(', ')}`)].reverse())",
    expect: 'green',
    note: () =>
      'BY DESIGN: PROSE reorders its own output lines — prose is another leg and is not gated',
  },
  // The harness testing itself. This is mutation B's PRE-FIX form: the hardcoded path
  // was dirty when it was written and has since been migrated by the C-domain lane, so
  // the mutation text matches nothing and the report comes out byte-identical. On the
  // `73ffd06c` re-derive that shape produced a reported "58 passed" for a control that
  // was never probed. Expected outcome now: the harness REFUSES and restores. If this
  // ever prints a result instead of throwing, the vacuity guard is gone.
  V: {
    anchor: DIRTY_LINE,
    expr: () =>
      "lines.push(...groupByPath(result.dirty.filter((s) => s.path !== " +
      "'packages/domain/test/a1-permission-policy.test.ts'), " +
      "(p, ss) => `OFFENDING ${p} :: ${ss.map(where).join(', ')}`))",
    expect: 'refused (vacuous by construction: its target path is clean on this base)',
    note: () => 'the pre-fix hardcoded B, kept as the guard\'s own test',
  },
}

const which = process.argv[2]
if (which === 'restore') {
  committedBase()
  copyFileSync(PRISTINE, TARGET)
  console.log('restored the committed fence script by cp; sha above must match the base record')
  process.exit(0)
}

const mutation = MUTATIONS[which]
if (mutation === undefined) {
  console.error('unknown mutation; known: ' + Object.keys(MUTATIONS).join(', '))
  process.exit(64)
}

const base = committedBase()
if (!base.includes(mutation.anchor)) {
  throw new Error('anchor not found in the committed producer — refusing to mutate blindly: ' + which)
}
const pristineReport = reportOf(PRISTINE)
if (!/^OFFENDING /m.test(pristineReport)) {
  copyFileSync(PRISTINE, TARGET)
  throw new Error('the pristine producer printed no OFFENDING line; the gate premise is gone')
}
const targets = resolveTargets(pristineReport)
const expr = mutation.expr(targets)
if (expr === mutation.anchor) throw new Error('mutation would be a no-op: ' + which)
writeFileSync(TARGET, base.replace(mutation.anchor, expr))

// A mutation that does not parse is a defect in the harness, not in the report: fail
// here, loudly, rather than letting vitest report an import error shaped like a result.
try {
  execSync('node --check ' + JSON.stringify(TARGET), { cwd: REPO, stdio: 'pipe' })
} catch (error) {
  copyFileSync(PRISTINE, TARGET)
  throw new Error('MUTATION ' + which + ' does not parse; restored.\n' + String(error.stderr ?? error))
}

const mutatedReport = reportOf(TARGET)
if (mutatedReport === pristineReport) {
  copyFileSync(PRISTINE, TARGET)
  throw new Error(
    'MUTATION ' + which +
      ' is VACUOUS: the mutated producer printed a byte-identical report. A mutation ' +
      ' that changes nothing cannot prove anything — restore ran, nothing was measured.',
  )
}

const firstOf = (report, tag) => report.split('\n').find((l) => l.startsWith(tag)) ?? '(none)'
console.log(
  'MUTATION ' + which + ' (expect ' + mutation.expect + '): ' + mutation.note(targets) +
    '\n  targets        : dirty paths=' + String(targets.pathCount) +
    ' dropped=' + targets.dropped +
    ' colliding=' + targets.collidingPath + ':L' + String(targets.collidingLine) +
    ' duplicated=' + targets.duplicated,
)
console.log('  first dirty line : ' + firstOf(mutatedReport, 'OFFENDING ').slice(0, 120))
console.log('  tally line       : ' + firstOf(mutatedReport, 'RESULT dirty('))
console.log('  report changed   : YES (differs from the pristine report)')
