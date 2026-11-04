#!/usr/bin/env node
/**
 * dry-run.mjs — the ZERO-BOOT preflight for the P2-01 six-row live acceptance.
 *
 * Every check below runs without a Host process, without a port and without a
 * DSH_HOME of its own. It is the ONE command the go/no-go checklist names:
 *
 *   node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs
 *
 * WHAT IT PROVES (each check is negative-control-bearing — a deliberate break of
 * the property makes THIS script fail; the control commands are in the
 * evidence README):
 *
 *   1. the shared three-way oracle (`tests/world-factory/lib/
 *      a5sf-acceptance-preflight.mjs`) is green under `node --test`, including
 *      the #575 split-root negative control and the NOT_REACHED/REFUTED/PASS
 *      discrimination for all six rows;
 *   2. the corrected driver carries NO second root literal, and its `team.create`
 *      precedes the state wait that asserts the SAME root;
 *   3. no row-verdict input is character-clipped in the driver;
 *   4. the World composes: factory create + patch emission + both blueprints
 *      parsed by the HOST's own dist facade + row-identity preflight + the
 *      product's lane algebra (A allow / B deny / C deny) + clean teardown;
 *   5. the six-row Member assembly MOUNTS against the real pinned
 *      `@deepseek-ai/dsh-tool-fs` with a real `attachments` provider, and the
 *      declaration arm refuses when it is absent (`mount-compat.json`);
 *   6. `packages/runtime/src/plugin/live/agent-bindings.mjs` is byte-identical to
 *      `origin/master` (CORE PATCH BUDGET = 0);
 *   7. the pinned World composition mounts `@deepseek-ai/dsh-attachment-local`
 *      (the `attachments` service the deferred `read_image` needs).
 *
 * WHAT IT CANNOT PROVE, STRUCTURALLY (stated in the README, printed here):
 *   - that the live Host runs the ACCEPTANCE blueprint's members (creation is a
 *     `team.create` RPC on a booted Host);
 *   - that the p6t6 directive it writes is the one the row reads (the directive
 *     path is World-internal and only exists after the boot);
 *   - that a row verdict is PASS on live data — the dry run proves the DECISION
 *     FUNCTION and the assembly, not the data.
 *
 * @module dev/agent-workflow/evidence/a5sf-preflight/dry-run
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
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
    argv: args.map((arg) => (arg.startsWith(REPO_ROOT) ? relative(REPO_ROOT, arg) : arg)),
    status: result.status,
    signal: result.signal ?? null,
    ms: Date.now() - started,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
  log(`${label}: status=${String(entry.status)} ms=${String(entry.ms)} stdout=${entry.stdout.split('\n').filter((l) => l.trim() !== '').length} lines stderr=${entry.stderr.split('\n').filter((l) => l.trim() !== '').length} lines`)
  return entry
}

const checks = []
function check(id, ok, detail) {
  checks.push({ id, ok: ok === true, detail })
  log(`CHECK ${ok === true ? 'PASS' : 'FAIL'} ${id}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  return ok === true
}

const report = {
  schema: 'a5sf-acceptance-preflight/dry-run/1',
  at: new Date().toISOString(),
  repoRoot: REPO_ROOT,
  head: null,
  checks,
  runs: {},
  agentBindings: null,
  structurallyUnverifiable: [
    'a live `team.create` of the acceptance blueprint on the booted Host (it is an RPC against a running Host; no host-free entry point exists)',
    'that the p6t6 directive the driver writes is the one the row reads (the directive path is World-internal and materialises only during boot)',
    'that the six rows are PASS on live data (the dry run proves the decision function and the assembly, not the data)',
    'that the Host\'s own teardown disposes the a5sf realm without a fault (the dispose observation channel is a live-State route)',
  ],
}

// ── 0. the driver and the shared contract, STATICALLY ───────────────────────
const DRIVER = join(HERE, 'run-boot.mjs')
const driverSource = readFileSync(DRIVER, 'utf8')
check('driver: no second root literal', !driverSource.includes("'session-a5sf-acceptance-root'") && !driverSource.includes("'session-a5sf-acceptance-team'") && !driverSource.includes('CREATE_ROOT'),
  'neither root literal appears in the driver; both come from P2_01_ACCEPTANCE_ROOTS')
check('driver: imports the shared contract', /P2_01_ACCEPTANCE_ROOTS/.test(driverSource) && /assertAcceptanceRootWiring/.test(driverSource) && /classifyDisposeFaults/.test(driverSource),
  'root identity + dispose classification are imported, not re-implemented')
check('driver: every row is judged by the shared oracle', ['judgePrecondition', 'judgeRow1', 'judgeRow2', 'judgeRow3', 'judgeRow4', 'judgeRow5', 'judgeRow6'].every((name) => driverSource.includes(`${name}(`)),
  'all seven decisions call into a5sf-acceptance-preflight.mjs')
const createIndex = driverSource.indexOf("'team.create'")
const stateAssertIndex = driverSource.indexOf('st.body?.rootSessionId === ACCEPTANCE_ROOT')
check('driver: create precedes the state assertion on the SAME root', createIndex > 0 && stateAssertIndex > createIndex,
  `team.create@${String(createIndex)} < state(rootSessionId===ACCEPTANCE_ROOT)@${String(stateAssertIndex)}`)
const resultClips = [...driverSource.matchAll(/result[A-Za-z]*\.text[^\n]*\.slice\(0,\s*\d+\)/g)].map((m) => m[0])
check('driver: no row-verdict result is character-clipped', resultClips.length === 0,
  resultClips.length === 0 ? 'no `result*.text.slice(0, N)` anywhere in the driver' : `found ${JSON.stringify(resultClips)}`)
check('driver: full teardown observations are persisted', !/observations\.slice\(-/.test(driverSource) && !/observationsAfterDrop\.slice\(-/.test(driverSource),
  'teardown.json carries the entire observation array, no tail-N window')
check('driver: declares expectedTools on the row', driverSource.includes('a5sfExpectedTools'),
  'the live attach refuses (A5SF_EXPECTED_TOOLS_UNSHADOWED) instead of silently keeping a preset read_image')

// The untouched product seam (CORE PATCH BUDGET = 0).
const BINDINGS = join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const bindingsHead = sha256File(BINDINGS)
const baseShow = spawnSync('git', ['show', 'origin/master:packages/runtime/src/plugin/live/agent-bindings.mjs'], { cwd: REPO_ROOT, encoding: 'utf8' })
const bindingsBase = baseShow.status === 0 ? createHash('sha256').update(baseShow.stdout).digest('hex') : null
report.agentBindings = { path: relative(REPO_ROOT, BINDINGS), sha256Head: bindingsHead, sha256OriginMaster: bindingsBase, untouched: bindingsBase === bindingsHead }
check('agent-bindings.mjs is untouched vs origin/master', bindingsBase !== null && bindingsBase === bindingsHead,
  `${bindingsHead} == ${String(bindingsBase)}`)

// ── 1. the oracle test suite ────────────────────────────────────────────────
report.runs.oracleTests = run('oracle-tests', ['--test', join(REPO_ROOT, 'tests', 'world-factory', 'a5sf-acceptance-preflight.test.mjs')])
const testText = report.runs.oracleTests.stdout + report.runs.oracleTests.stderr
const passMatch = /(?:#|ℹ) pass (\d+)/.exec(testText)
const failMatch = /(?:#|ℹ) fail (\d+)/.exec(testText)
report.oracleTests = { pass: passMatch === null ? null : Number(passMatch[1]), fail: failMatch === null ? null : Number(failMatch[1]) }
check('oracle suite is green', report.runs.oracleTests.status === 0 && report.oracleTests.fail === 0 && (report.oracleTests.pass ?? 0) > 0,
  `pass=${String(report.oracleTests.pass)} fail=${String(report.oracleTests.fail)}`)

// ── 2. the World plan (composition + config + lane algebra) ─────────────────
// Plan mode appends to run.log; keep the plan evidence separate so a later live
// run's run.log is unambiguously the live one.
const RUN_LOG = join(HERE, 'run.log')
if (existsSync(RUN_LOG)) rmSync(RUN_LOG)
report.runs.plan = run('plan', [DRIVER, '--plan'])
if (existsSync(RUN_LOG)) renameSync(RUN_LOG, join(HERE, 'plan.log'))
const plan = JSON.parse(readFileSync(join(HERE, 'plan.json'), 'utf8'))
check('plan: root wiring', plan.rootWiring?.ok === true, plan.rootWiring)
check('plan: attachments provider composed', plan.attachmentsProvider?.mounted === true, plan.attachmentsProvider?.evidence ?? null)
check('plan: both blueprints ingest through the host facade', plan.blueprints?.anchor?.ok === true && plan.blueprints?.main?.ok === true, plan.blueprints)
check('plan: patch layer carries the boot root + expectedTools', plan.patch?.containsBootRoot === true && plan.patch?.containsExpectedTools === true, { bytes: plan.patch?.bytes, sha256: plan.patch?.sha256 })
check('plan: row identity preflight', plan.rowIdentity?.ok === true, plan.rowIdentity?.rows ?? null)
const disposition = Object.fromEntries((plan.lane?.dispositions ?? []).map((entry) => [entry.locator.split('/').pop(), entry.effective]))
check('plan: lane algebra A allow / B deny / C deny', disposition['a.txt'] === 'allow' && disposition['b.txt'] === 'deny' && disposition['c.txt'] === 'deny', disposition)
check('plan: world torn down', plan.world?.teardown?.homeDeleted !== undefined && !existsSync(String(plan.world?.home ?? '')), { home: plan.world?.home, teardown: plan.world?.teardown })
// Keep ONLY the latest World's emitted composition (the six-row profile), so the
// committed evidence is the composition this preflight certifies, not nine
// retries of it.
const LOGS = join(HERE, 'logs')
if (existsSync(LOGS)) {
  for (const entry of readdirSync(LOGS)) {
    const dir = join(LOGS, entry)
    if (!statSync(dir).isDirectory() || entry === plan.world?.id) continue
    rmSync(dir, { recursive: true, force: true })
  }
}
const keptLogs = existsSync(LOGS) ? readdirSync(LOGS).filter((entry) => statSync(join(LOGS, entry)).isDirectory()) : []
check('plan: only the latest World log directory is kept', keptLogs.length <= 1, keptLogs)

// ── 3. the mount-compatibility measurement ──────────────────────────────────
report.runs.mountProbe = run('mount-probe', [join(HERE, 'probe-mount-compat.mjs')])
const mount = JSON.parse(readFileSync(join(HERE, 'mount-compat.json'), 'utf8'))
const armOf = (label) => mount.arms.find((arm) => arm.label === label) ?? null
const armA = armOf('A-real-attachment-store')
const armB = armOf('B-stub-attachments')
const armC = armOf('C-no-attachments-declared')
const armD = armOf('D-no-attachments-undeclared')
const allForwarded = ['read', 'write', 'edit', 'read_image']
const armOk = (arm) => arm !== null && arm.mounted === true && allForwarded.every((name) => (arm.forwardedUnion ?? []).includes(name)) && allForwarded.every((name) => (arm.surface ?? []).includes(name))
check('mount: real attachments -> MOUNTED, 4/4 forwarded AND visible', armOk(armA), armA === null ? null : { forwarded: armA.forwardedUnion, surface: armA.surface, routing: armA.routing })
check('mount: stub attachments -> MOUNTED, 4/4', armOk(armB), armB === null ? null : { forwarded: armB.forwardedUnion, surface: armB.surface })
check('mount: no attachments + declaration -> typed REFUSAL naming read_image', armC !== null && armC.mounted === false && armC.error?.code === 'A5SF_EXPECTED_TOOLS_UNSHADOWED',
  armC === null ? null : { code: armC.error?.code, message: String(armC.error?.message ?? '').slice(0, 400) })
check('mount: no attachments + undeclared -> MOUNTED with read_image absent (the refused-name premise)', armD !== null && armD.mounted === true && (armD.forwardedUnion ?? []).includes('read_image') === false,
  armD === null ? null : { forwarded: armD.forwardedUnion })

// ── 4. the exact head this preflight certifies ─────────────────────────────
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' })
report.head = head.status === 0 ? String(head.stdout).trim() : null
report.base = String(spawnSync('git', ['rev-parse', 'origin/master'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout ?? '').trim() || null
// The PRODUCT tree (everything outside this evidence directory): a dirty product
// tree means the run certified different bytes than the ones a boot would execute.
// The evidence files themselves are the run's output, so they are excluded.
report.productStatusPorcelain = String(spawnSync('git', ['status', '--porcelain', '--untracked-files=no', '--', ':!dev/agent-workflow/evidence'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout ?? '').trim()
report.productTreeClean = report.productStatusPorcelain === ''
report.pinnedHost = (() => { try { return readFileSync(join(REPO_ROOT, 'tests', 'paths.mjs'), 'utf8').match(/TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]+)'/)?.[1] ?? null } catch { return null } })()
report.goNoGo = checks.every((entry) => entry.ok === true)
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(HERE, 'dry-run.log'), LOG_LINES.join('\n') + '\n')
log(`wrote ${OUT}; checks=${String(checks.length)} failed=${String(checks.filter((entry) => entry.ok !== true).length)} goNoGo=${String(report.goNoGo)}`)
log('STRUCTURALLY UNVERIFIABLE WITHOUT A BOOT: ' + report.structurallyUnverifiable.join(' | '))
process.exitCode = report.goNoGo ? 0 : 1
