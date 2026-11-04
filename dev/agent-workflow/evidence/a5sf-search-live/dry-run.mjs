#!/usr/bin/env node
/**
 * dry-run.mjs — the ZERO-BOOT preflight for the P2-03 / BL-16 live half.
 *
 * Every check runs without a Host, without a port and without a DSH_HOME. It is
 * the ONE command the go/no-go checklist names:
 *
 *   node dev/agent-workflow/evidence/a5sf-search-live/dry-run.mjs
 *
 * WHAT IT PROVES (each negative-control-bearing; `negative-controls.mjs` breaks
 * each property and requires THIS script to go red):
 *
 *   1. the shared three-way oracle is green under `node --test` (44 arms), and
 *      each of the six rows discriminates NOT_REACHED / REFUTED / PROVEN;
 *   2. the driver's case list IS the contract's closed list; every case is
 *      dispatched through `judgeSearchRow`; `team.create` precedes the state
 *      assertion on the SAME root; no verdict input is clipped; the abort-after-
 *      Host rule is a FAIL, never NOT_REACHED;
 *   3. `run-boot.mjs --plan` is green (the driver's own host-free gate: patch
 *      emission, blueprint parse by the HOST's facade, row identity, emitted
 *      dist carries BL-16/BL-17);
 *   4. the boot path has no undefined identifier and no use-before-define, and a
 *      TDZ probe is REFUSED (the lint is load-bearing, not decorative);
 *   5. the lane ALGEBRA is the product's: for the composed ceiling/restriction the
 *      in-lane operand is allowed, the outside-ceiling operand is denied, and the
 *      inside-ceiling/outside-restriction operand is DENIED by the intersection
 *      while the restriction ALONE would allow it — i.e. the intersection is
 *      doing the work, and it never widens;
 *   6. the product seam the rows depend on is present, byte-for-byte, in THIS
 *      tree: the confined subprocess admission order (attribution -> intents ->
 *      write-lane -> guard), the `rg`-only static program list, the method
 *      `spawn`, the member-realm default identity, the member realm's optional
 *      subprocess face, and the BL-17 total `faces` answer;
 *   7. the pinned search module declares `subprocess` and builds its argv with a
 *      `--` separator and `--json` (the shape BL-16's B2/B3 arms measured);
 *   8. the FIFO cancellation premise is RE-MEASURED here: a real `rg` given a
 *      FIFO as an explicit operand blocks (killed by a timeout), which is what
 *      gives row 4 a window at all;
 *   9. CORE PATCH BUDGET = 0: `agent-bindings.mjs` is byte-identical to
 *      `origin/master` and the product tree has no uncommitted change.
 *
 * WHAT IT CANNOT PROVE, STRUCTURALLY (printed here and carried into the report):
 *   - that the live preset SUPPLIES a confined `subprocess` face: it does not,
 *     and the boot's provider row composes it. Whether the preset could is not a
 *     dry-run question;
 *   - that a Member's tool call actually reaches that face (that is what the ONE
 *     boot measures, and the only thing it can measure);
 *   - that row 4's cancellation window is wide enough on THIS host (measured at
 *     boot time; the FIFO premise is re-measured, the timing is not);
 *   - that the OS denies a process the profile should confine (P1-07's own legs).
 *
 * @module dev/agent-workflow/evidence/a5sf-search-live/dry-run
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const HOST_TREE = existsSync(join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js'))
  ? join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  : join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const LIB = join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'a5sf-search-live.mjs')
const DRIVER = join(HERE, 'run-boot.mjs')
const PROVIDER = join(HERE, 'a5sf-search-realm-provider-row.mjs')
const LOG_LINES = []
const OUT = join(HERE, 'dry-run.json')

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  // eslint-disable-next-line no-console
  console.log(line)
  LOG_LINES.push(line)
}
function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
function run(label, args, options = {}) {
  const started = Date.now()
  const result = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 600_000, ...options })
  const entry = {
    label,
    argv: args.map((arg) => (String(arg).startsWith(REPO_ROOT) ? relative(REPO_ROOT, String(arg)) : String(arg))),
    status: result.status,
    signal: result.signal ?? null,
    ms: Date.now() - started,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
  log(`${label}: status=${String(entry.status)} ms=${String(entry.ms)} stdoutLines=${String(entry.stdout.split('\n').filter((l) => l.trim() !== '').length)} stderrLines=${String(entry.stderr.split('\n').filter((l) => l.trim() !== '').length)}`)
  return entry
}
function git(args, cwd = REPO_ROOT) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { status: r.status, stdout: String(r.stdout ?? '').trim() }
}

const checks = []
function check(id, ok, detail) {
  checks.push({ id, ok: ok === true, detail })
  log(`CHECK ${ok === true ? 'PASS' : 'FAIL'} ${id}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  return ok === true
}

const report = {
  schema: 'a5sf-search-live/dry-run/1',
  at: new Date().toISOString(),
  repoRoot: REPO_ROOT,
  hostTree: HOST_TREE,
  head: git(['rev-parse', 'HEAD']).stdout || null,
  checks,
  runs: {},
  productTreeDigest: null,
  structurallyUnverifiable: [
    'that the LIVE PRESET supplies a confined `subprocess` face to the Member realm: it does not at this base; the boot composes it in the evidence provider row (see README §3)',
    'that a Member tool call actually reaches that face — the ONE boot measures this, and nothing host-free can',
    'that row 4\'s cancellation window is wide enough on THIS host: the FIFO-blocking premise is re-measured below, the end-to-end timing is not measurable without a Host',
    'that the OS kernel denies a process the compiled profile should confine (P1-07 owns that leg)',
  ],
}

// ── 1. the shared oracle, under `node --test` ───────────────────────────────
const oracle = run('oracle: node --test a5sf-search-live.test.mjs', ['--test', join(REPO_ROOT, 'tests', 'world-factory', 'a5sf-search-live.test.mjs')])
report.runs.oracle = { status: oracle.status, ms: oracle.ms }
const oraclePass = /^# pass (\d+)$/mu.exec(oracle.stdout)?.[1] ?? /ℹ pass (\d+)/u.exec(oracle.stdout)?.[1] ?? null
const oracleFail = /ℹ fail (\d+)/u.exec(oracle.stdout)?.[1] ?? null
check('oracle: the six-row three-way suite is green', oracle.status === 0 && oracleFail === '0' && Number(oraclePass) >= 40,
  { pass: oraclePass, fail: oracleFail, status: oracle.status })

// ── 2. the driver and the contract, STATICALLY ─────────────────────────────
const driverSource = readFileSync(DRIVER, 'utf8')
const libSource = readFileSync(LIB, 'utf8')
const providerSource = readFileSync(PROVIDER, 'utf8')

check('driver: no second root literal', !driverSource.includes("'session-a5sf-acceptance-root'") && !driverSource.includes("'session-a5sf-acceptance-team'"),
  'neither root literal appears; both come from P2_01_ACCEPTANCE_ROOTS')
check('driver: imports the shared root identity + the shared oracle', /P2_01_ACCEPTANCE_ROOTS/u.test(driverSource)
  && /assertAcceptanceRootWiring/u.test(driverSource)
  && /judgeSearchRow/u.test(driverSource)
  && /judgeCase/u.test(driverSource)
  && /sampleCompleteness/u.test(driverSource)
  && /summarizeRun/u.test(driverSource)
  && /judgeNegativeControl/u.test(driverSource),
  'root identity, six-row dispatch, per-case status, run fold and the control all come from the shared modules')
check('driver: the case list IS the contract list', /const CASES = Object\.freeze\(\[\.\.\.SEARCH_CASES\]\)/u.test(driverSource)
  && /assertCaseListMatchesContract/u.test(driverSource),
  'a drifted/renamed id throws before the grant, not after a spent start')
const createIndex = driverSource.indexOf("'team.create'")
const stateAssertIndex = driverSource.indexOf('st.body?.rootSessionId === ACCEPTANCE_ROOT')
check('driver: create precedes the state assertion on the SAME root', createIndex > 0 && stateAssertIndex > createIndex,
  `team.create@${String(createIndex)} < state(rootSessionId===ACCEPTANCE_ROOT)@${String(stateAssertIndex)}`)
const clips = [...driverSource.matchAll(/result[A-Za-z]*\.text[^\n]*\.slice\(0,\s*\d+\)/gu)].map((m) => m[0])
check('driver: no row-verdict input is character-clipped', clips.length === 0,
  clips.length === 0 ? 'no `result*.text.slice(0, N)` on any verdict path' : JSON.stringify(clips))
check('driver: the full guard-fact stream is persisted', /writeFileSync\(join\(HERE, FACTS_NAME\)/u.test(driverSource)
  && /writeFileSync\(join\(HERE, 'search-counter\.jsonl'\)/u.test(driverSource),
  'guard-facts.json + search-counter.jsonl are the raw channels, not a summary')
check('driver: declares expectedTools for BOTH native modules', /a5sfExpectedTools:\s*\{/u.test(driverSource)
  && /grep', 'glob'/u.test(driverSource),
  'the attach refuses (A5SF_EXPECTED_TOOLS_UNSHADOWED) instead of silently keeping the preset search')
// THE PARTIAL-RUN LAW (2026-11-05). The old rule here was "an abort after the
// Host is reached is a FAIL, never NOT_REACHED" — true about the RUN, but it was
// implemented by fail-closing every case, so the 2026-11-04T19:17Z abort threw
// away seven facts that had already been measured. The law that survives is
// "never launder a missing observation into a pass"; the one that does not is
// "discard observations you actually made".
check('driver: an aborted run JUDGES what it measured and still reports the RUN as FAIL',
  /sampleCompleteness\(/u.test(driverSource)
  && /judgeCase\(/u.test(driverSource)
  && /abortedAt: abortStage/u.test(driverSource)
  && /record\.markAborted\(/u.test(driverSource)
  && /summarizeRun\(/u.test(driverSource)
  && /judgeSettledRows\('delegate-dispatch'\)/u.test(driverSource),
  'complete samples keep their case verdict after an abort (a case PASS is not a run PASS); incomplete ones are NOT_REACHED + driver-aborted; the run is FAIL + partial, and the settled rows are judged BEFORE the cancellation window')
check('driver: a case is never fail-closed to FAIL merely because the run aborted',
  !/add\(id, 'FAIL', \{ reason: `DRIVER_ABORTED_AT_/u.test(driverSource)
  && /if \(record\.getCase\(id\) !== undefined\) continue/u.test(driverSource),
  'the 2026-11-04 loop assigned FAIL/DRIVER_ABORTED to every row with no sample — discarding the rows that had one')
check('driver: the start budget is the RULING FILE, not a constant the driver may raise', /readRuling\(\)/u.test(driverSource)
  && /bootSequence > ruling\.starts/u.test(driverSource)
  && /DEDICATED_ALLOCATION_EXHAUSTED/u.test(driverSource)
  && /lane-ruling\.json/u.test(driverSource),
  'authorisedStarts sums named rulings; a start without a named ruling is a self-authorisation')
check('driver: the cancellation trigger is the SHIPPED client route', /apiSessionCancel/u.test(driverSource)
  && !/interruptRoute/u.test(driverSource),
  '/api/session/cancel -> agent.cancel({kind:"user"}); no test route composes a cancel')
check('driver: the FIFO window is created or the boot refuses', /execFileSync\('mkfifo'/u.test(driverSource)
  && /must not be spent/u.test(driverSource),
  'a row-4 window that cannot be created refuses the boot instead of measuring nothing')
// THE HANDOFF DEFECT (2026-11-04T15:36Z, the lane's one attempt): the driver
// emitted four rows in --plan, then never pushed them into `world.u6Fs.rows`,
// so the Host booted a BARE World and `/__p6t6/health` never existed. `--plan`
// was green because it only checked the EMITTED text. This check is on the
// handoff itself, and the negative control removes the line and requires RED.
check('driver: the composed rows are GIVEN to the World (not only emitted)', /function handOverRows\(world, rows\)/u.test(driverSource)
  && (driverSource.match(/^\s+handOverRows\(world, rows\)\s*$/gmu) ?? []).length === 1
  && driverSource.indexOf('handOverRows(world, rows)') < driverSource.indexOf('harness.boot('),
  'the rows must reach `world.u6Fs.rows` through ONE handoff function BEFORE the spawn; an emitted-but-unpushed row set boots a bare World and burns the start')
// CONDITION 2 of the retry ruling: content-bearing, not length-bearing. The
// artifacts below are produced by RUNNING the handoff against a probe in --plan.
check('driver: --plan hands the rows over and writes the identity artifact', /handOverRows\(probeWorld, dry\.rows\)/u.test(driverSource)
  && /PLAN_ROWS_PATH/u.test(driverSource)
  && /identityHolds/u.test(driverSource),
  'plan-rows.json must carry emittedRowIds and worldRowIds so the gate compares CONTENT, not a count')
check('driver: the leader DENIES grep/glob (the coverage gate refuses them unmanaged on a root session)', /LEADER_MANAGED_TOOL_NAMES/u.test(driverSource)
  && /!LEADER_MANAGED_TOOL_NAMES\.includes\(n\)/u.test(driverSource)
  && /TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED|known-sensitive-unmanaged/u.test(driverSource),
  'the retry refused team.create on exactly this; the Member still gets grep/glob through its realm')
// CONDITION 2 of the LAST-start ruling: the cheap pre-team.create artifact.
// F1's cause was swallowed twice because the instrument's record lived inside
// the World home that teardown deletes; the probe now persists the counter and
// the fact sink OUT of the home before team.create and again on the abort path.
check('driver: the leader grep probe runs FIRST — before the control and before team.create — and persists its channels outside the home',
  /MK_PROBE/u.test(driverSource)
  && driverSource.indexOf("abortStage = 'leader-grep-probe'") < driverSource.indexOf("abortStage = 'negative-control'")
  && driverSource.indexOf("abortStage = 'leader-grep-probe'") < driverSource.indexOf("abortStage = 'surface'")
  && /LEADER_GREP_PROBE_FAILED/u.test(driverSource)
  && /persistRunChannels/u.test(driverSource)
  && /probe-leader-grep\.json/u.test(driverSource),
  'a base-spawn failure must reach the artifact with its Node cause, and the counter/sink must survive teardown')
{
  const ruling = JSON.parse(readFileSync(join(HERE, 'lane-ruling.json'), 'utf8'))
  const pool = JSON.parse(readFileSync(join(REPO_ROOT, 'dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json'), 'utf8'))
  const p204 = (pool?.allocation ?? []).find((item) => String(item?.item ?? '').startsWith('P2-04')) ?? null
  const poolBoots = Number(p204?.boots ?? 0)
  const namedStarts = ruling.rulings.reduce((n, r) => n + Number(r?.starts ?? 0), 0)
  check('ruling: every authorised start is a NAMED ruling, and the pool allocates exactly that many',
    namedStarts === poolBoots
      && ruling.rulings.length >= 3
      && Number(ruling.authorisedStarts) >= 1
      && Number(ruling.authorisedStarts) <= namedStarts
      && ruling.rulings.every((r) => String(r.by ?? '').length > 0 && String(r.reason ?? '').length > 0),
    'the NAMED entries are the authorisation and must equal the pool item; authorisedStarts is the frozen ORIGINAL allocation and may never exceed them (a re-grant is appended, never an edit of the frozen number) — a start without a named ruling is a self-authorisation')
}
check('driver: the control counts only ITS OWN operand and the member-install abort carries the delegate answer',
  /rowPaths\.outsideDir/u.test(driverSource)
  && /delegate-artifact\.json/u.test(driverSource)
  && /teamCalls/u.test(driverSource)
  && /MEMBER_INSTALL_NO_WORKER/u.test(driverSource),
  'the probe turn runs first, so a name-only control count answers without its grep (NOT_REACHED at 18:53Z); and no-Member-appeared must carry what team_delegate answered')
check('row artifact: the confined exit row carries the payload stderr',
  /stderrChunks/u.test(providerSource) && /stderr: Buffer\.concat\(stderrChunks\)/u.test(providerSource) && /handleStderr\.on\('data'/u.test(providerSource),
  'row 1 can fail as a real REFUTED verdict (an in-lane grep exiting 2); without the payload stderr the reason dies with the World home')
check('driver: the search module is mounted WITH the config its schema requires',
  /sampleOverCapGlobResults: false/u.test(driverSource)
  && /\{ url: pathToFileURL\(HOST_TOOL_FS_SEARCH\)\.href, config:/u.test(driverSource),
  'a bare string entry mounts tool-fs-search with an empty config and the realm install is refused with SERVICE_MOUNT_FAILED (captured 2026-11-04T19:05Z)')
check('driver: the mock sequences on TOOL RESULTS, not assistant tool_use echoes',
  /function resultIdsOf/u.test(driverSource)
  && !/const greps = countAssistantToolUses\(req, 'grep'\)/u.test(driverSource),
  'this harness does not echo the assistant tool_use block, so a tool_use counter never advances: every turn re-issued its call and burned 120 s')
// The FIFO's PLACEMENT is checked by the product algebra in §5b, from the paths
// `--plan` actually composed. A text match cannot decide it: attempt 6's
// `fifo: join(laneDir, 'blocking.fifo')` was a well-formed path, one directory
// outside the restriction, and it cost the run its cancellation window.
check('driver: the abort stage distinguishes composition / member-install / delegate-dispatch / cancellation-window',
  ['composition', 'member-install', 'delegate-dispatch', 'cancellation-window'].every((stage) => new RegExp(`abortStage = '${stage}'`, 'u').test(driverSource))
  && /COMPOSITION_ROWS_MISSING/u.test(driverSource)
  && /DELEGATE_DISPATCH_NEVER_REACHED_MEMBER/u.test(driverSource)
  && /CANCELLATION_WINDOW_NO_CONFINED_SPAWN/u.test(driverSource),
  'one generic post-boot abort wastes a start; the stage names say WHICH handoff broke')
check('driver: the boot-mode run-record bindings are exercised host-free', /function runBindings\(/u.test(driverSource)
  && /bindings: runBindings\(head, grant\)/u.test(driverSource)
  && /runBindings\(head === null/u.test(driverSource),
  'a broken binding literal must fail in --plan, not after a start is spent')

check('oracle: every judge is three-way and names its clauses', ['judgeRow1', 'judgeRow2', 'judgeRow3', 'judgeRow4', 'judgeRow5', 'judgeRow6'].every((name) => libSource.includes(`export function ${name}`))
  && (libSource.match(/return notReached\(/gu) ?? []).length >= 12
  && libSource.includes('function verdictOf')
  && libSource.includes('failed,'),
  'each judge has a reachability branch, a named-clause check set, and a REFUTED path')
check('oracle: row 1 records the realm instead of assuming the binding realm', libSource.includes('factRealm') && libSource.includes('toolBindingIdentity'),
  'BL-17 makes a binding-realm subprocess face a refusal; the judge RECORDS `member`/`null` (README §3)')
check('oracle: row 3 states the preset limit in the VERDICT, not only the README', libSource.includes('presetExpressesBindingRestriction: false') && libSource.includes('presetLimit'),
  'a reader of the machine verdict sees that the restriction was composed by the fixture')
check('oracle: row 4 accepts an undelivered settlement ONLY with a killed child', libSource.includes('CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT') && libSource.includes('childTerminatedBySignal'),
  'no silent green: absence of a result counts only with positive termination evidence')
check('oracle: row 5 is discriminated by the PROCESS exit code, not the prose', libSource.includes('processExitedTwo') && libSource.includes('notPresentedAsNoMatches'),
  'a module that swallowed rg exit 2 into "No matches found" differs on this clause')
check('oracle: row 6 is temporal, and judges the probe delta separately', libSource.includes('noFactAfterStop') && libSource.includes('probeFactsAreRefusals') && libSource.includes('factsAreTimestamped'),
  'the boot-2 lesson: a count delta cannot express "nothing after the stop"')

// ── 3. the driver's own host-free gate ─────────────────────────────────────
const plan = run('driver: --plan', [DRIVER, '--plan'])
report.runs.plan = { status: plan.status, ms: plan.ms, patchBytes: /patch layer bytes=(\d+)/u.exec(plan.stdout)?.[1] ?? null }
check('driver --plan is green', plan.status === 0 && plan.stdout.includes('PLAN OK'),
  plan.status === 0 ? 'PLAN OK' : plan.stderr.split('\n').filter((l) => l.trim() !== '').slice(-3).join(' | '))
// The plan output is part of the evidence: keep it whole.
writeFileSync(join(HERE, 'plan.log'), LOG_LINES.filter((line) => line.includes('--plan') || line.includes('patch layer') || line.includes('PLAN OK')).join('\n') + '\n')
report.runs.planStdout = plan.stdout

// ── 4. the static net over the boot path ───────────────────────────────────
const lintTargets = [DRIVER, PROVIDER, LIB, join(HERE, 'dry-run.mjs'), join(HERE, 'go-no-go.mjs'), join(HERE, 'negative-controls.mjs')]
const eslintBin = [join(REPO_ROOT, 'node_modules', '.bin', 'eslint'), join(REPO_ROOT, '..', '..', 'node_modules', '.bin', 'eslint')].find((p) => existsSync(p)) ?? join(REPO_ROOT, 'node_modules', '.bin', 'eslint')
const lintConfig = join(HERE, 'no-undef.config.mjs')
let lintResult = { ok: false, detail: 'eslint binary not found' }
if (existsSync(eslintBin)) {
  const lint = spawnSync(eslintBin, ['--config', lintConfig, ...lintTargets], { encoding: 'utf8' })
  const errors = String(lint.stdout ?? '').split('\n').filter((line) => /\s+error\s/u.test(line))
  lintResult = {
    ok: lint.status === 0 && errors.length === 0,
    detail: errors.length === 0
      ? `exit=${String(lint.status)} no undefined/use-before-define errors across ${String(lintTargets.length)} boot-path files`
      : errors.slice(0, 5).join(' | '),
  }
}
check('boot path: no undefined identifiers / use-before-define in the driver, row, oracle', lintResult.ok, lintResult.detail)
let tdzResult = { ok: false, detail: 'eslint binary not found' }
if (existsSync(eslintBin)) {
  const probe = join(HERE, '.tdz-probe.mjs')
  writeFileSync(probe, 'function f(){ return late }\nconst late = 1\nexport default f\n')
  try {
    const lint = spawnSync(eslintBin, ['--config', lintConfig, probe], { encoding: 'utf8' })
    const caught = /no-use-before-define/u.test(String(lint.stdout ?? '')) && lint.status !== 0
    tdzResult = { ok: caught, detail: caught ? 'the use-before-define probe is REFUSED, so the rule is load-bearing' : 'the probe passed lint: the TDZ rule is NOT active' }
  } finally {
    rmSync(probe, { force: true })
  }
}
check('boot path: a use-before-define is refused (the homePin shape)', tdzResult.ok, tdzResult.detail)

// ── 5. the lane algebra, HOST-FREE, on the product's own functions ─────────
const pathRules = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'path-rules.js')).href)
const tmp = mkdtempSync(join(tmpdir(), 'a5sf-search-lane-'))
const WS = join(tmp, 'workspace')
const IN = join(WS, 'lane', 'inside')
const DENY_INSIDE_CEILING = join(WS, 'lane', 'outside-restriction.txt')
const OUTSIDE = join(tmp, 'home', 'ceiling-outside')
const lane = (mode, allow) => ({ mode, allow, ask: [], deny: [] })
const ceiling = lane('restricted', [WS])
const restriction = lane('restricted', [IN])
const effective = pathRules.intersectPathRuleSets(ceiling, restriction)
const dCeiling = {
  in: pathRules.matchLocator(ceiling, IN),
  denyInside: pathRules.matchLocator(ceiling, DENY_INSIDE_CEILING),
  outside: pathRules.matchLocator(ceiling, OUTSIDE),
}
const dRestriction = {
  in: pathRules.matchLocator(restriction, IN),
  denyInside: pathRules.matchLocator(restriction, DENY_INSIDE_CEILING),
}
const dEffective = {
  in: pathRules.matchLocator(effective, IN),
  denyInside: pathRules.matchLocator(effective, DENY_INSIDE_CEILING),
  outside: pathRules.matchLocator(effective, OUTSIDE),
}
report.laneAlgebra = { ceiling: dCeiling, restriction: dRestriction, effective: dEffective, effectiveLane: effective }
check('lane: the in-lane operand is allowed by ceiling, restriction AND the intersection', dCeiling.in === 'allow' && dRestriction.in === 'allow' && dEffective.in === 'allow', dEffective.in)
check('lane: the outside-ceiling operand is denied by the ceiling and by the intersection', dCeiling.outside === 'deny' && dEffective.outside === 'deny', { ceiling: dCeiling.outside, effective: dEffective.outside })
check('lane: the inside-ceiling / outside-restriction operand is denied ONLY because of the restriction', dCeiling.denyInside === 'allow' && dRestriction.denyInside === 'deny' && dEffective.denyInside === 'deny',
  { ceiling: dCeiling.denyInside, restriction: dRestriction.denyInside, effective: dEffective.denyInside })
check('lane: the intersection NEVER widens (no allow the ceiling denies)', [IN, DENY_INSIDE_CEILING, OUTSIDE].every((locator) => !(pathRules.matchLocator(effective, locator) === 'allow' && pathRules.matchLocator(ceiling, locator) === 'deny')),
  'the upper-bound law EffectiveIo ⊆ Ceiling is checked on the three operands')

// ── 5b. the cancellation FIFO must be INSIDE the effective read lane ────────
// Attempt 6 (2026-11-04T19:17Z) put the FIFO at `lane/blocking.fifo`: inside the
// ceiling, OUTSIDE the narrower tool restriction, so the guard refused it at
// admission (`deny IO_READ_DENIED`), no confined spawn ever opened the window,
// and the run aborted after 240 s with four rows already measured. This check
// reads the paths `--plan` composed and lets the PRODUCT algebra decide.
const planPaths = JSON.parse(readFileSync(join(HERE, 'plan-paths.json'), 'utf8'))
const planCeiling = lane('restricted', planPaths.ceilingReadAllow)
const planRestriction = lane('restricted', planPaths.restrictionReadAllow)
const planEffective = pathRules.intersectPathRuleSets(planCeiling, planRestriction)
const fifoDisposition = {
  fifo: planPaths.fifo,
  ceiling: pathRules.matchLocator(planCeiling, planPaths.fifo),
  restriction: pathRules.matchLocator(planRestriction, planPaths.fifo),
  effective: pathRules.matchLocator(planEffective, planPaths.fifo),
}
report.fifoDisposition = fifoDisposition
check('driver: the cancellation FIFO is ADMITTED by the effective read lane',
  fifoDisposition.ceiling === 'allow' && fifoDisposition.restriction === 'allow' && fifoDisposition.effective === 'allow',
  fifoDisposition)
// And the SAME inputs must REFUSE the attempt-6 operand, or the check above
// would be green for "any FIFO anywhere" and prove nothing.
const attempt6Fifo = join(planPaths.ceilingReadAllow[0], 'lane', 'blocking.fifo')
const attempt6FifoDisposition = {
  fifo: attempt6Fifo,
  ceiling: pathRules.matchLocator(planCeiling, attempt6Fifo),
  restriction: pathRules.matchLocator(planRestriction, attempt6Fifo),
  effective: pathRules.matchLocator(planEffective, attempt6Fifo),
}
report.attempt6FifoDisposition = attempt6FifoDisposition
check('lane: the attempt-6 FIFO placement (lane/blocking.fifo) is DENIED by the effective lane',
  attempt6FifoDisposition.ceiling === 'allow' && attempt6FifoDisposition.effective === 'deny',
  attempt6FifoDisposition)

// The partial-run oracle, exercised as a RUN (not only as the six static judges):
// a complete sample that passed, a complete sample that was contradicted, and an
// incomplete one, all after an abort. `negative-controls.mjs` breaks each of the
// three properties and requires THIS script to go red.
const partialProbe = await (async () => {
  const module = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'a5sf-search-live.mjs')).href)
  const root = '/w/lane'
  const factOne = {
    schema: 'a5sf-guard-consult/1', realm: 'member', memberIdentity: 'm', toolBindingIdentity: null,
    policyRevision: 'r', method: module.SUBPROCESS_GUARD_METHOD, locator: root, decision: 'allow',
    decidedBy: 'ALLOW', observedAt: '2026-11-05T00:00:00.000Z',
  }
  const spawnRow = { leg: 'confined-spawn', argv: ['/rg', '--no-config', '--json', '--regexp=A5SF_SEARCH_NEEDLE', '--', root], cwd: '/w', at: '2026-11-05T00:00:00.000Z' }
  const complete = {
    result: { source: 'model', isError: false, text: `Found 1 match in ${root}/needle.txt\n${root}/needle.txt:1:A5SF_SEARCH_NEEDLE` },
    facts: [factOne], records: [spawnRow], declaredRoot: root, needle: 'A5SF_SEARCH_NEEDLE', fileName: 'needle.txt',
  }
  const wrongBytes = { ...complete, result: { source: 'model', isError: false, text: 'No matches found' } }
  const incomplete = { ...complete, result: null }
  const passCase = module.judgeCase(module.SEARCH_CASE_IDS.row1, complete, { abortedAt: 'cancellation-window' })
  const incompleteCase = module.judgeCase(module.SEARCH_CASE_IDS.row1, incomplete, { abortedAt: 'cancellation-window' })
  const wrongCase = module.judgeCase(module.SEARCH_CASE_IDS.row1, wrongBytes, { abortedAt: 'cancellation-window' })
  const runFold = module.summarizeRun([passCase, incompleteCase], { abortedAt: 'cancellation-window' })
  return { passCase, incompleteCase, wrongCase, runFold }
})()
report.partialRun = partialProbe
check('partial run: a COMPLETE sample after a later abort is judged PASS at CASE level',
  partialProbe.passCase.verdict === 'PASS' && partialProbe.passCase.status === 'judged' && partialProbe.passCase.sampleComplete === true,
  { verdict: partialProbe.passCase.verdict, status: partialProbe.passCase.status })
check('partial run: an INCOMPLETE sample after an abort is NOT_REACHED + driver-aborted (never PASS)',
  partialProbe.incompleteCase.verdict === 'NOT_REACHED' && partialProbe.incompleteCase.status === 'driver-aborted'
  && partialProbe.incompleteCase.missing.includes('result') && partialProbe.passCase.verdict !== 'NOT_REACHED',
  { verdict: partialProbe.incompleteCase.verdict, status: partialProbe.incompleteCase.status, missing: partialProbe.incompleteCase.missing })
check('partial run: a COMPLETE sample with the WRONG bytes is FAIL, never PASS',
  partialProbe.wrongCase.verdict === 'FAIL' && partialProbe.wrongCase.status === 'judged' && partialProbe.wrongCase.sampleComplete === true,
  { verdict: partialProbe.wrongCase.verdict, status: partialProbe.wrongCase.status })
check('partial run: the RUN is FAIL + partial even though one case PASSED',
  partialProbe.runFold.overall === 'FAIL' && partialProbe.runFold.partial === true
  && partialProbe.runFold.passed.length === 1 && partialProbe.runFold.neverObserved.length === 1
  && partialProbe.runFold.judged.length === 1,
  partialProbe.runFold)

// ── 6. the product seam the rows depend on ─────────────────────────────────
const teamServices = join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src')
const subprocessSrc = readFileSync(join(teamServices, 'subprocess.ts'), 'utf8')
const installSrc = readFileSync(join(teamServices, 'install.ts'), 'utf8')
const mountSrc = readFileSync(join(teamServices, 'mount.ts'), 'utf8')
const realmRowSrc = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
const seat = {
  staticProgramList: /CONFINED_SUBPROCESS_STATIC_PROGRAMS[^\n]*freeze\(\['rg'\]\)/u.test(subprocessSrc),
  guardMethod: /SUBPROCESS_GUARD_METHOD\s*=\s*'spawn'/u.test(subprocessSrc),
  programAttribution: /programAttributionRefusal/u.test(subprocessSrc),
  writeLaneRefusal: /programWriteLaneRefusal/u.test(subprocessSrc),
  admissionOrder: (() => {
    const admission = subprocessSrc.indexOf('export function createConfinedSubprocessClass')
    if (admission === -1) return false
    const body = subprocessSrc.slice(admission)
    const order = ['programAttributionRefusal(spec)', 'readIntentsOf(spec)', 'programWriteLaneRefusal(spec.argv[0]', 'for (const intent of intents) await guard(']
      .map((token) => body.indexOf(token))
    return order.every((index) => index !== -1) && order.every((index, i) => i === 0 || index > order[i - 1])
  })(),
  memberRealmDefault: /realm:\s*options\.realm\s*\?\?\s*'member'/u.test(subprocessSrc),
  installIsolatesSubprocess: /isolate\('subprocess'/u.test(installSrc),
  installStatesFaces: /const faces: RealmServiceFaces = Object\.freeze/u.test(installSrc),
  mountRefusesUnconfined: /SUBPROCESS_UNCONFINED_REALM/u.test(mountSrc),
  realmRowForwardsOptionalFace: /compiled\.subprocess !== undefined/u.test(realmRowSrc)
    && /provider\.spawnStreaming/u.test(realmRowSrc)
    && /subprocess: compiled\.subprocess/u.test(realmRowSrc),
}
report.productSeam = seat
for (const [name, ok] of Object.entries(seat)) {
  check(`product seam: ${name}`, ok, ok ? 'present in THIS tree' : 'MISSING: the rows would measure a different product')
}
const searchModule = readFileSync(join(HOST_TREE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js'), 'utf8')
check('pinned search module declares the `subprocess` injection', /inject\s*=\s*\[[^\]]*"subprocess"/u.test(searchModule) || /inject\s*=\s*\[[^\]]*'subprocess'/u.test(searchModule),
  'the module consumes the confined face; a `subprocess`-free module would not exercise it')
check('pinned search module builds argv with `--json` and a `--` separator', searchModule.includes('--json') && /"--",\s*\.\.\./u.test(searchModule) || searchModule.includes('"--"'),
  'the operand-after-`--` shape is what `readIntentsOf` reads (BL-16 B2/B3)')

// ── 7. the FIFO cancellation premise, RE-MEASURED ──────────────────────────
let fifoResult = { ok: false, detail: 'mkfifo/packaged ripgrep unavailable' }
try {
  // The PACKAGED binary the host module itself resolves (never a system `rg`):
  // the row-4 window must exist for the binary the Member's tool call launches.
  const hostRequire = createRequire(join(HOST_TREE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js'))
  const rgPath = (await import(pathToFileURL(hostRequire.resolve('@vscode/ripgrep')).href)).rgPath
  const dir = mkdtempSync(join(tmpdir(), 'a5sf-search-fifo-'))
  const fifo = join(dir, 'blocking.fifo')
  spawnSync('mkfifo', [fifo], { stdio: 'ignore' })
  const rg = spawnSync(rgPath, ['--no-config', '--json', '--regexp=x', '--', fifo], { encoding: 'utf8', timeout: 2500 })
  // ENOENT/EACCES would mean the binary never ran; only a KILLED, still-blocked
  // process proves the window. `status === null && signal === 'SIGTERM'` is it.
  // `spawnSync` reports ETIMEDOUT as an ERROR and also kills the child, so a
  // timeout is evidence of BLOCKING, while ENOENT/EACCES is evidence of NOT RUNNING.
  const launched = rg.error === undefined || rg.error.code === 'ETIMEDOUT'
  const blocked = rg.signal === 'SIGTERM' || rg.status === 124 || rg.error?.code === 'ETIMEDOUT'
  fifoResult = {
    ok: launched && existsSync(fifo) && blocked,
    detail: {
      rgPath,
      fifoCreated: existsSync(fifo),
      launched,
      signal: rg.signal ?? null,
      status: rg.status ?? null,
      error: rg.error?.code ?? null,
      why: launched && blocked ? 'the packaged rg blocks on an explicit FIFO operand (the row-4 window exists)' : 'the packaged rg did NOT block or did not launch: row 4 would measure nothing',
    },
  }
  rmSync(dir, { recursive: true, force: true })
} catch (error) {
  fifoResult = { ok: false, detail: String(error?.message ?? error) }
}
report.fifoPremise = fifoResult
check('row 4 premise: ripgrep BLOCKS on an explicit FIFO operand (the cancellation window exists)', fifoResult.ok, fifoResult.detail)

// ── 7b. the EMITTED dist is the one this source produces ───────────────────
// A stale dist would make the boot measure yesterday's product. Two facts,
// host-free: (a) the worktree's `packages/` tree is identical to origin/master,
// so the committed source is the source the dist was built from; (b) every
// emitted artifact the rows depend on is NEWER than the last commit that touched
// its source (the main checkout builds after the commit; the worktree's dist is
// a byte-identical copy).
const distProvenance = (() => {
  const diff = git(['diff', '--stat', 'origin/master', '--', 'packages']).stdout
  const lastSource = Number(git(['log', '-1', '--format=%ct', '--',
    'packages/runtime/team-services/src/subprocess.ts',
    'packages/runtime/team-services/src/install.ts',
    'packages/runtime/src/plugin/live/a5sf-realm-row.mjs',
    'packages/runtime/member-io-policy/src/path-rules.ts',
  ]).stdout)
  const artifacts = [
    join(DIST, 'team-services', 'src', 'subprocess.js'),
    join(DIST, 'team-services', 'src', 'install.js'),
    join(DIST, 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'),
    join(DIST, 'member-io-policy', 'src', 'path-rules.js'),
  ].map((path) => {
    const stamp = existsSync(path) ? Number(statSync(path).mtimeMs) / 1000 : null
    return { path: relative(REPO_ROOT, path), mtime: stamp === null ? null : new Date(stamp * 1000).toISOString(), newerThanLastSourceCommit: stamp !== null && Number.isFinite(lastSource) && stamp > lastSource }
  })
  return { packagesIdenticalToOriginMaster: diff === '', lastSourceCommit: Number.isFinite(lastSource) ? new Date(lastSource * 1000).toISOString() : null, artifacts }
})()
report.distProvenance = distProvenance
check('dist: the worktree `packages/` tree is identical to origin/master', distProvenance.packagesIdenticalToOriginMaster,
  distProvenance.packagesIdenticalToOriginMaster ? '(no diff)' : git(['diff', '--stat', 'origin/master', '--', 'packages']).stdout.slice(0, 400))
check('dist: every artifact the rows depend on is NEWER than the last source commit', distProvenance.artifacts.every((entry) => entry.newerThanLastSourceCommit),
  { lastSourceCommit: distProvenance.lastSourceCommit, artifacts: distProvenance.artifacts })

// ── 8. CORE PATCH BUDGET = 0 ───────────────────────────────────────────────
const BINDINGS = join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const bindingsHead = sha256File(BINDINGS)
const baseShow = spawnSync('git', ['show', 'origin/master:packages/runtime/src/plugin/live/agent-bindings.mjs'], { cwd: REPO_ROOT, encoding: 'utf8' })
const bindingsBase = baseShow.status === 0 ? createHash('sha256').update(baseShow.stdout).digest('hex') : null
report.agentBindings = { path: relative(REPO_ROOT, BINDINGS), sha256Head: bindingsHead, sha256OriginMaster: bindingsBase, untouched: bindingsBase === bindingsHead }
check('agent-bindings.mjs is untouched vs origin/master', bindingsBase !== null && bindingsBase === bindingsHead, `${bindingsHead} == ${String(bindingsBase)}`)
const productStatus = git(['status', '--porcelain', '--untracked-files=no', '--', ':!dev/agent-workflow/evidence']).stdout
check('the product tree has no uncommitted modification', productStatus === '', productStatus === '' ? '(clean)' : productStatus)

// ── 9. the product digest the go/no-go gate binds ──────────────────────────
const tree = git(['ls-tree', '-r', 'HEAD', '--', 'packages', 'scripts', 'tests', 'docs/plans', 'docs/contracts', 'dev/engineering', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
report.productTreeDigest = createHash('sha256').update(tree.stdout).digest('hex')

rmSync(tmp, { recursive: true, force: true })
report.goNoGo = checks.every((entry) => entry.ok === true)
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(HERE, 'dry-run.log'), LOG_LINES.join('\n') + '\n')
// eslint-disable-next-line no-console
console.log(report.goNoGo
  ? `DRY RUN GREEN — ${String(checks.length)} checks, head=${String(report.head)} digest=${report.productTreeDigest}`
  : `DRY RUN RED — ${String(checks.filter((c) => c.ok !== true).length)} of ${String(checks.length)} failed: ${checks.filter((c) => c.ok !== true).map((c) => c.id).join(', ')}`)
process.exitCode = report.goNoGo ? 0 : 1
