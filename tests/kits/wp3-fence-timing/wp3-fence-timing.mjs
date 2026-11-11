#!/usr/bin/env node
/**
 * wp3-fence-timing.mjs — WP3 (P1) A6-STOP-FENCE timing instrument.
 *
 * WHAT THIS IS. A driver around the canonical A6-12 Stop arm
 * (`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`,
 * `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_STOP=1`) that
 *   (a) PLACES the Stop at a chosen point relative to the guard's durable
 *       decision instead of racing it, and
 *   (b) classifies each run from DURABLE FACTS only (control-ledger rows,
 *       sequence counter, side-effect file, late re-allow refusal code).
 *
 * HOW THE TIMING IS CONTROLLED (instrument only — zero product change).
 * `C1_A6_STOP_TIMING_MS='{"resolve":R,"stop":S}'` is handed to the kit. Both
 * events are scheduled against the ONE durable anchor the SERVICE wrote: the
 * human leg's `control-request-recorded` row `createdAt`, read back from
 * `<DSH_HOME>/storages/team_domain.json`. The allow is issued at
 * `createdAt + R` ms, the Stop at `createdAt + S` ms.
 *
 * The guard's post-decision run begins on the waiter's poll grid:
 * `ControlService.awaitControlDecision` polls at
 * `DEFAULT_WAIT_POLL_INTERVAL_MS = 250` ms with the first poll synchronous at
 * wait start, and the wait starts immediately after that request row is
 * written. So the guard's consumption boundary is at
 * `createdAt + 250·n + (guard work)` — a grid an external instrument can aim
 * at with the product's own documented constant. This is the
 * production-equivalent seam: no sleep in product code, no test hook, no
 * upstream patch, no `--keep`-style state.
 *
 * WHAT IT PROVES (per run, from durable facts):
 *   1. ordering — the durable `allow` decision row predates the Stop we sent
 *      (both clocks are the same machine clock) and no `control-allow-consumed`
 *      row exists, i.e. the Stop was observed BY the final consumption probe;
 *   2. zero consumption + the decision row is still `allow` (never rewritten);
 *   3. exactly one `control-request-abandoned` with reason
 *      `invocation-cancelled-before-consumption` and the deliberately burned
 *      sequence (`decisionSequence + 1` has no row, the abandonment is at
 *      `decisionSequence + 2`);
 *   4. zero side effect — no effect file, no execution fact, and the late
 *      re-allow is refused `CONTROL_REQUEST_ABANDONED`.
 *
 * WHAT IT CANNOT PROVE. (i) That a Stop issued *inside* the sub-millisecond
 * write await landed there: an abort observed after the synchronous probe is
 * indistinguishable, from durable facts, from one that landed a fraction of a
 * millisecond later — both commit the consumption. The driver reports the
 * observed boundary and the steering resolution, not an atomicity claim.
 * (ii) Anything about production latency: every offset is wall-clock steering
 * of a test World on this host. (iii) That the fence is stable: n agreeing
 * boots are agreement, not stability.
 *
 * ISOLATION. One fresh `DSH_HOME` per run (the c1 kit derives
 * `tests/homes/c1-smoke-<stamp>` and deletes it at teardown unless --keep),
 * loopback only, host ports from the 1700x band and mock ports from the 1705x
 * band as this lane's reservation (other lanes hold 1400x/1500x/1600x).
 * `:3080` is only read-probed by the kit. `--keep` keeps the World AND prints
 * its path for the evidence record.
 *
 * USAGE
 *   node tests/kits/wp3-fence-timing/wp3-fence-timing.mjs \
 *     --worktree <tree> --testuse <pristine checkout> \
 *     --evidence-dir <dir> --host-port 17001 --mock-port 17051 \
 *     --resolve-ms 240 --stop-ms 12 --label r1 [--keep]
 *
 *   # sweep: one fresh World per offset, k-th run gets host-port+k / mock-port+k
 *   ... --sweep-stops 4,6,8,10,12 --resolve-ms 240 --label-prefix s1
 *
 * EXIT CODES
 *   0 = every trial's durable classification is `fence-reached`
 *   3 = at least one trial is not `fence-reached` (classification is in the
 *       evidence dir; a `residual-consumed` trial is a FINDING, not a crash)
 *   2 = the kit itself failed (boot/world/row error, exit 1 from the kit)
 *   1 = instrument misuse (bad args, port busy, no worktree)
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')

const argv = process.argv.slice(2)
function argValue(name, dflt) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = argv[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const KEEP = argv.includes('--keep')
const WORKTREE = resolve(argValue('worktree', REPO))
// The gitignored pristine host checkout exists in the MAIN checkout, not in a
// task worktree (<main>/.worktrees/<task>), so the default falls back the same
// way the c1 kit does.
function defaultTestuse() {
  const local = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
  if (existsSync(local)) return local
  return resolve(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const TESTUSE = resolve(argValue('testuse', defaultTestuse()))
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'wp3-fence-timing', 'adhoc')))
const HOST_PORT_BASE = Number(argValue('host-port', 17001))
const MOCK_PORT_BASE = Number(argValue('mock-port', 17051))
const RESOLVE_MS = Number(argValue('resolve-ms', 240))
const LABEL = argValue('label', 'trial')
const LABEL_PREFIX = argValue('label-prefix', null)
const SWEEP = argValue('sweep-stops', null)
const TRIALS = Number(argValue('trials', 1))
const KIT = join(WORKTREE, 'tests', 'kits', 'c1-leader-approval-smoke', 'c1-leader-approval-smoke.mjs')

if (!existsSync(KIT)) fail(1, `kit not found at ${KIT} — check --worktree`)

function fail(code, message) {
  console.error(`FATAL ${message}`)
  process.exit(code)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The planned trials: one (label, stop offset) pair each. */
function plan() {
  if (SWEEP !== null) {
    const stops = SWEEP.split(',').map(Number)
    if (stops.some((n) => !Number.isFinite(n))) fail(1, `--sweep-stops must be comma-separated numbers, got ${SWEEP}`)
    const prefix = LABEL_PREFIX ?? LABEL
    return stops.map((stop, i) => ({ label: `${prefix}-s${stop}`, stop, resolve: RESOLVE_MS, index: i }))
  }
  return Array.from({ length: TRIALS }, (_, i) => ({
    label: TRIALS > 1 ? `${LABEL}-${i + 1}` : LABEL,
    stop: Number(argValue('stop-ms', 12)),
    resolve: RESOLVE_MS,
    index: i,
  }))
}

function runKit(trial) {
  const runDir = join(EVIDENCE_DIR, trial.label)
  mkdirSync(runDir, { recursive: true })
  const env = {
    ...process.env,
    C1_ALPHA6_OFFICER: '1',
    C1_PLANE_TAKEOVER: '1',
    C1_A6_STOP: '1',
    C1_A6_STOP_TIMING_MS: JSON.stringify({ resolve: trial.resolve, stop: trial.stop }),
  }
  const args = [
    KIT,
    '--worktree', WORKTREE,
    '--testuse', TESTUSE,
    '--host-port', String(HOST_PORT_BASE + trial.index),
    '--mock-port', String(MOCK_PORT_BASE + trial.index),
    '--evidence-dir', runDir,
  ]
  if (KEEP) args.push('--keep')
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, { cwd: WORKTREE, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (b) => { out += b.toString() })
    child.stderr.on('data', (b) => { out += b.toString() })
    child.on('close', (code) => {
      writeFileSync(join(runDir, 'kit.stdout.log'), out)
      resolvePromise({ code, out, runDir })
    })
  })
}

/** Classify ONE run from its durable artifacts only. */
function classify(runDir, trial) {
  const p = join(runDir, 'a6-stop.json')
  if (!existsSync(p)) return { verdict: 'missing-artifact', trial, detail: 'a6-stop.json absent (kit died before the arm)' }
  const stop = JSON.parse(readFileSync(p, 'utf8'))
  const manifestPath = join(runDir, 'run-manifest.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
  const requestId = stop?.humanLeg?.requestId ?? null
  const ledger = stop?.ledger ?? {}
  const decisions = (ledger.decisions ?? []).filter((d) => d.requestId === requestId)
  const consumptions = (ledger.consumptions ?? []).filter((c) => c.requestId === requestId)
  const abandonments = (ledger.abandonments ?? []).filter((a) => a.requestId === requestId)
  const executionResults = (ledger.executionResults ?? []).filter((e) => e.requestId === requestId)
  const decision = decisions.at(-1) ?? null
  const consumption = consumptions.at(-1) ?? null
  const abandonment = abandonments.at(-1) ?? null
  const lateRefusal = stop?.lateAllow?.result?.error?.code
    ?? stop?.lateAllow?.error?.code
    ?? null
  const fileAfter = stop?.fileAfter ?? ''
  const stopSentAt = stop?.timing?.stopSentAt ?? null
  const stopReturnedAt = stop?.timing?.stopReturnedAt ?? null
  const decisionCreatedAt = decision?.createdAt ?? null
  const orderMs = (a, b) => (a === null || b === null ? null : Date.parse(b) - Date.parse(a))

  const req = {
    decisionAllow: decision?.decision === 'allow',
    stopAfterDecision: orderMs(decisionCreatedAt, stopSentAt) !== null && orderMs(decisionCreatedAt, stopSentAt) >= 0,
    resolveBeforeStop: orderMs(stop?.timing?.resolveSentAt, stopSentAt) !== null && orderMs(stop?.timing?.resolveSentAt, stopSentAt) >= 0,
    zeroConsumption: consumption === null,
    exactlyOneAbandonment: abandonments.length === 1,
    fenceReason: abandonment?.reason === 'invocation-cancelled-before-consumption',
    burnedSequence: decision !== null && abandonment !== null && abandonment.sequence === decision.sequence + 2,
    noExecutionFact: executionResults.length === 0,
    zeroSideEffect: fileAfter === '',
    lateAllowRefusedAbandoned: lateRefusal === 'CONTROL_REQUEST_ABANDONED',
    lateAllowRefusedDecided: lateRefusal === 'CONTROL_REQUEST_DECIDED',
  }

  // Ordered classification: the decisive durable shape, not intent.
  let verdict
  if (consumption !== null) verdict = 'residual-consumed'
  else if (abandonment !== null && req.fenceReason) verdict = 'fence-reached'
  else if (abandonment !== null) verdict = `abandoned-other:${String(abandonment.reason)}`
  else if (decision !== null) verdict = 'pre-fence'
  else verdict = 'no-decision'

  // The four required assertions of WP3, as POSITIVE predicates; the two
  // "refused as X" predicates are kept for the record but are not failures
  // when false (a fence trip must be refused ABANDONED, a pre-fence run
  // DECIDED — each arm has its own expected refusal).
  const required = [
    'decisionAllow',
    'stopAfterDecision',
    'resolveBeforeStop',
    'zeroConsumption',
    'exactlyOneAbandonment',
    'fenceReason',
    'burnedSequence',
    'noExecutionFact',
    'zeroSideEffect',
    'lateAllowRefusedAbandoned',
  ]

  return {
    verdict,
    label: trial.label,
    planned: { resolveOffsetMs: trial.resolve, stopOffsetMs: trial.stop },
    productSha: manifest?.productSha ?? null,
    productTree: manifest?.productTree ?? null,
    hostBaselineSha: manifest?.hostBaselineSha ?? null,
    requestId,
    timings: {
      anchorCreatedAt: stop?.timing?.anchorRow?.createdAt ?? null,
      resolveSentAt: stop?.timing?.resolveSentAt ?? null,
      resolveReturnedAt: stop?.timing?.resolveReturnedAt ?? null,
      decisionCreatedAt,
      stopSentAt,
      stopReturnedAt,
      stopAfterDecisionMs: orderMs(decisionCreatedAt, stopSentAt),
      stopAfterResolveSentMs: orderMs(stop?.timing?.resolveSentAt, stopSentAt),
      decisionAfterStopSentMs: orderMs(stopSentAt, decisionCreatedAt),
      abandonmentCreatedAt: abandonment?.createdAt ?? null,
      decisionToAbandonmentMs: orderMs(decisionCreatedAt, abandonment?.createdAt ?? null),
      decisionToConsumptionMs: orderMs(decisionCreatedAt, consumption?.createdAt ?? null),
    },
    sequences: {
      counterAtFinalRead: stop?.ledgerCounter ?? null,
      request: stop?.humanLeg?.sequence ?? null,
      decision: decision?.sequence ?? null,
      consumption: consumption?.sequence ?? null,
      abandonment: abandonment?.sequence ?? null,
      burned: decision !== null && abandonment !== null ? { expectedGap: decision.sequence + 1, abandonmentAt: abandonment.sequence } : null,
    },
    rows: { decisions, consumptions, abandonments, executionResults },
    requirements: req,
    /** Anchor-relative offsets (ms from the durable request row's createdAt):
     *  the run's own clock, so two boots are comparable field by field. */
    offsets: (() => {
      const anchor = stop?.timing?.anchorRow?.createdAt ?? null
      const rel = (iso) => (anchor === null || iso === null || iso === undefined
        ? null
        : Date.parse(iso) - Date.parse(anchor))
      return {
        decision: rel(stop?.timing?.decisionCreatedAt ?? decision?.createdAt),
        stopSent: rel(stop?.timing?.stopSentAt),
        stopReturned: rel(stop?.timing?.stopReturnedAt),
        consumptionWrite: rel(consumption?.createdAt),
        abandonmentWrite: rel(abandonment?.createdAt),
        /** Positive ⇒ the Stop request was issued AFTER the consumption was
         *  durable; negative ⇒ it was in flight/before when the write
         *  committed (the fence's residual side). */
        stopSentMinusConsumptionWriteMs: rel(stop?.timing?.stopSentAt) === null || rel(consumption?.createdAt) === null
          ? null
          : rel(stop?.timing?.stopSentAt) - rel(consumption?.createdAt),
        stopSentMinusAbandonmentWriteMs: rel(stop?.timing?.stopSentAt) === null || rel(abandonment?.createdAt) === null
          ? null
          : rel(stop?.timing?.stopSentAt) - rel(abandonment?.createdAt),
      }
    })(),
    failedRequirements: required.filter((k) => req[k] !== true),
  }
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const trials = plan()
  const results = []
  for (const trial of trials) {
    console.log(`── trial ${trial.label}: resolve=${trial.resolve}ms stop=${trial.stop}ms after the durable request row`)
    const started = Date.now()
    const run = await runKit(trial)
    // Ports are released on teardown; give the OS a moment before the next boot.
    await sleep(500)
    const result = classify(run.runDir, trial)
    result.kitExit = run.code
    result.wallMs = Date.now() - started
    const table = [
      `# ${trial.label} — durable sequence table (CANDIDATE-C2, ${result.productSha ?? 'NO MANIFEST'})`,
      '',
      `verdict: **${result.verdict}**   planned resolve=+${trial.resolve}ms stop=+${trial.stop}ms`,
      '',
      '| seq | fact | createdAt | note |',
      '| --- | --- | --- | --- |',
      ...(result.rows.decisions.map((d) => `| ${d.sequence} | ${d.factType} (${d.decision}) | ${d.createdAt} | decider=${JSON.stringify(d.decider)} |`)),
      ...(result.rows.consumptions.map((c) => `| ${c.sequence} | ${c.factType} | ${c.createdAt} | CONSUMPTION |`)),
      ...(result.rows.abandonments.map((a) => `| ${a.sequence} | ${a.factType} (${a.reason}) | ${a.createdAt} | terminal mark |`)),
      ...(result.sequences.burned ? [`| ${result.sequences.burned.expectedGap} | *(no row)* | — | BURNED by the fence (gap) |`] : []),
      '',
      `counter at final read: ${String(result.sequences.counterAtFinalRead)}`,
      '',
      '| requirement | value |',
      '| --- | --- |',
      ...Object.entries(result.requirements).map(([k, v]) => `| ${k} | ${String(v)} |`),
      '',
      `timings: ${JSON.stringify(result.timings, null, 1)}`,
      '',
      `kit exit: ${String(result.kitExit)}   wall: ${String(result.wallMs)}ms`,
    ].join('\n')
    writeFileSync(join(run.runDir, 'wp3-seq-table.md'), table)
    writeFileSync(join(run.runDir, 'wp3-classification.json'), JSON.stringify(result, null, 2))
    results.push(result)
    console.log(`   → ${result.verdict}; req=${result.failedRequirements.length === 0 ? 'ALL PASS' : `fails=${result.failedRequirements.join(',')}`}; decision=${String(result.sequences.decision)} abandonment=${String(result.sequences.abandonment)} consumption=${String(result.sequences.consumption)}`)
    if (run.code === 1) {
      writeFileSync(join(EVIDENCE_DIR, `SUMMARY-${LABEL}.json`), JSON.stringify({ trials: results }, null, 2))
      fail(2, `kit failed fatally in ${trial.label} (see ${run.runDir})`)
    }
  }
  writeFileSync(join(EVIDENCE_DIR, `SUMMARY-${LABEL}.json`), JSON.stringify({ trials: results }, null, 2))
  const fence = results.filter((r) => r.verdict === 'fence-reached').length
  console.log(`── ${fence}/${results.length} trial(s) fence-reached`)
  process.exit(fence === results.length ? 0 : 3)
}

main().catch((error) => fail(1, error instanceof Error ? error.stack ?? error.message : String(error)))
