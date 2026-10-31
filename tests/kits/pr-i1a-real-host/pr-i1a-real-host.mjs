#!/usr/bin/env node
/**
 * Alpha.6 PR-I1a (Lane 2) — the REAL-HOST instrument for the durability legs PR #517 recorded as C2 = ENV_BLOCK.
 *
 * WHAT THIS PAYS. PR #517's body §4 (D-10) and §8 line 223 both state that no Host process was ever booted for
 * this PR, so nothing in it may be read as a Host-level pass, and the restart legs were C1 at best because the
 * in-memory fake's close/open is a repository rebuild and not a disk. That was true at `256410456` and every
 * earlier head of this branch, and it was recorded as a refusal rather than dressed up as a green. A real
 * runtime is now materialized in THIS worktree (`tests/deepseek-harness-test-use`, pristine, detached at
 * `TEST_USE_BASELINE_SHA`), so the claim is re-graded by measurement instead of by re-reading the memo.
 *
 * WHAT A BOOT HERE CAN AND CANNOT REACH. PR-I1a ships a DORMANT writer: `ALLOWED_CONSUMERS` is empty and the
 * dormancy walk in `a6-pr2-lane-hygiene.test.ts` proves no production module imports it. So no product seam
 * reaches `applyReviewAssignment` on a live host — that is the design, and PR-I1b is the first PR with a caller.
 * Two consequences, both disclosed rather than papered over:
 *   - these boots mount a PROBE row (`pri1a-probe-row.mjs`) through the public profile-patch seam, and that row
 *     wires the writer's ports to the host's own `storageDomain` service using the lane's own
 *     `root-binding/harness/seam.mjs` — the same seam the production row is configured with through `seamUrl`.
 *     The writer, the ledger repository, the TeamSession repository and the contract parsers are this worktree's
 *     BUILT artifacts, not a re-implementation;
 *   - the production `dsh-agent-team` row is NOT mounted in the two durability boots, because it opens the same
 *     `team_domain` name and the medium is opened once per process. So these boots measure the writer against
 *     the host's real durable medium across a real process restart; they do NOT measure interleaving with
 *     `ControlService` or any client projection rendering, and this kit does not claim either.
 *
 * THE LEGS (each one is a measurement, and a leg that cannot run is a NAMED refusal — never green, never a
 * false red):
 *   1. write     — created → replay → transferred → retired through the writer, on the host's real medium.
 *   2. generation— `team_sessions.generation` advances once per durable write and not for the replay.
 *   3. raw bytes — the fact-type strings exist in the world's files on disk, read by THIS process, outside the
 *                  host, after the host stopped. This is the leg the in-memory fake could never fake.
 *   4. restart   — a SECOND host process, same `DSH_HOME`, reopens the domain and folds the same three rows.
 *   5. replay    — the first command, re-issued in the fresh process, answers `already` at its ORIGINAL
 *                  sequence and writes nothing.
 *   6. continue  — a new family in the fresh process gets a sequence AFTER the durable chain, not a restart of it.
 *
 * ENVIRONMENT. World = `tests/homes/<stamp>-<label>` (workspace-internal, TEST_METHODS §7), deleted at teardown
 * unless `--keep-world`; teardown proves `tests/homes/` is empty again. Ports come from the 318x family and 3080
 * (the stable instance) and 3180 (not rented to worlds) are never used; every port is probed before use and
 * proven free after teardown. Process marker `a6pri1a<stamp><label>host<port>` — unique to this run, so
 * teardown kills only what this run started. `DSH_HOME` is set explicitly on every spawn and never inherited.
 * The launch token never reaches evidence: every string that can carry a boot URL passes `scrub()`.
 *
 * Usage: node tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs [--port 3182] [--keep-world]
 * Exit 0 only when every check passed; exit 1 naming the failures; exit 3 with `verdict=env-refused` when the
 * environment cannot answer at all (that is a refusal, not a pass and not a red).
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join, relative } from 'node:path'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA } from '../../paths.mjs'

// The worktree root from THIS file's location — NOT tests/paths.mjs#findTestRepoRoot, which walks upward
// looking for a materialized runtime and can land on a different tree than the one that owns this kit.
const WORKTREE = join(import.meta.dirname, '..', '..', '..')
const RUNTIME = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOMES = join(WORKTREE, 'tests', 'homes')

const argv = process.argv.slice(2)
const KEEP_WORLD = argv.includes('--keep-world')
const PORT_OVERRIDE = (() => {
  const i = argv.indexOf('--port')
  return i >= 0 ? Number(argv[i + 1]) : null
})()

const PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186, 3187, 3188, 3189]
const FORBIDDEN_PORTS = new Set([3080, 3180])
const RUN_STAMP = `a6pri1a-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}Z`
const DIST_ROOT = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const PROBE_ROW = `file://${join(import.meta.dirname, 'pri1a-probe-row.mjs')}`
const EVIDENCE_ROOT = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha6-pri1a-real-host')

const ROOT_SESSION = `session-a6pri1a-host-${RUN_STAMP.slice('a6pri1a-'.length)}`
const CASE_ID = 'approval-case-a6pri1a'
const FACT_TYPES = ['review-assignment-created', 'review-assignment-transferred', 'review-assignment-retired']

const lines = []
const log = (s) => { lines.push(String(s)); console.log(String(s)) }
/** The launch token never leaves this file: anything that can carry a boot URL is scrubbed before storage. */
const scrub = (s) => String(s).replace(/([?&]token=)[^&#\s]*/g, '$1<REDACTED>')

const results = []
/** PASS/FAIL only for legs that RAN. `refuse()` records a leg that could not run — never green, never red. */
const check = (id, ok, measured) => {
  results.push({ id, verdict: ok === true ? 'PASS' : 'FAIL', measured: String(measured) })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id} — ${scrub(measured)}`)
}
const refuse = (id, cause) => {
  results.push({ id, verdict: 'REFUSED', measured: String(cause) })
  log(`REFUSED ${id} — ${scrub(cause)}`)
}

const gitOut = (args, cwd) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
const porcelainCount = (tree) => gitOut(['status', '--porcelain'], tree).split('\n').filter((l) => l !== '').length

const portInUse = (port) => new Promise((resolve) => {
  const socket = createConnection({ host: '127.0.0.1', port })
  socket.setTimeout(1500)
  socket.once('connect', () => { socket.destroy(); resolve(true) })
  socket.once('timeout', () => { socket.destroy(); resolve(false) })
  socket.once('error', () => { socket.destroy(); resolve(false) })
})

/** Every regular file under `dir` (worlds are small; the guard is depth, not size). */
function filesUnder(dir, depth = 0, out = []) {
  if (depth > 8) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) filesUnder(abs, depth + 1, out)
    else if (entry.isFile()) out.push(abs)
  }
  return out
}

/**
 * Boot one host over one world and hand back its readiness seam. `mode` selects the probe scenario; the SAME
 * world is booted twice (write, then restart) so the restart crosses a real process boundary.
 */
async function bootWorld({ label, port, mode, home, reportPath }) {
  const logPath = join(home, `host-${label}.log`)
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const probeConfig = {
    mode,
    rootSessionId: ROOT_SESSION,
    approvalCaseId: CASE_ID,
    workspace: home,
    reportPath,
    distRoot: `file://${DIST_ROOT}/`,
  }
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), [
    `# PR-I1a real-host instrument (world ${RUN_STAMP}-${label}): the probe row that drives THIS worktree's BUILT`,
    '# durable writer over the host storageDomain service, mounted ONLY through the public profile-patch seam',
    '# (CORE PATCH BUDGET = 0). The production dsh-agent-team row is deliberately absent: it owns the same',
    '# team_domain name, and these boots measure the writer against the medium, not against the composition.',
    '- insert:',
    '  - id: a6pri1a-probe',
    `    name: ${PROBE_ROW}`,
    '    config:',
    ...Object.entries(probeConfig).map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`),
    '',
  ].join('\n'))

  writeFileSync(logPath, '')
  const fd = openSync(logPath, 'a')
  const marker = `a6pri1a${RUN_STAMP.replace(/[^a-z0-9]/g, '')}${label}host${port}`
  const child = spawn('/bin/bash', ['-c', `exec -a ${marker} node apps/cli/lib/bin.js web --port ${port} --no-open`], {
    cwd: RUNTIME, stdio: ['ignore', fd, fd],
    env: { ...process.env, DSH_HOME: home, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH },
  })
  log(`${label}: spawned marker=${marker} port=${port} DSH_HOME=${relative(WORKTREE, home)}`)

  let bootUrl = null
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline && bootUrl === null) {
    await new Promise((r) => setTimeout(r, 1000))
    const m = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/.exec(readFileSync(logPath, 'utf8'))
    if (m) bootUrl = m[1]
  }
  if (bootUrl === null) {
    const tail = readFileSync(logPath, 'utf8').split('\n').slice(-40).join('\n')
    child.kill('SIGKILL')
    throw new Error(`${label}: no boot line within 240s. log tail:\n${scrub(tail)}`)
  }
  const token = new URL(bootUrl).searchParams.get('token')
  const origin = `http://127.0.0.1:${port}`
  const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual' })
  const cookie = (auth.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const health = async () => fetch(`${origin}/__a6pri1a/health`, { headers: cookie === '' ? {} : { cookie } })
    .then((r) => r.json()).catch(() => null)

  // The probe does its work inside apply(), i.e. before the boot line; the health route is the readiness channel.
  let report = null
  const probeDeadline = Date.now() + 120_000
  while (Date.now() < probeDeadline) {
    if (existsSync(reportPath)) { report = JSON.parse(readFileSync(reportPath, 'utf8')); break }
    await new Promise((r) => setTimeout(r, 1000))
  }

  const stop = async () => {
    child.kill('SIGTERM')
    await new Promise((r) => setTimeout(r, 4000))
    let alive = child.exitCode === null && child.signalCode === null
    if (alive) {
      spawn('/bin/bash', ['-c', `pkill -f '${marker}' || true`])
      await new Promise((r) => setTimeout(r, 2000))
      alive = child.exitCode === null && child.signalCode === null
    }
    const free = !(await portInUse(port))
    // The host's own log is read BEFORE the world is deleted — it is evidence, and the world is not.
    const logText = existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
    return { alive, free, logText }
  }

  return { label, port, home, logPath, marker, origin, bootUrl, authStatus: auth.status, hasCookie: cookie !== '', health, report, reportPath, stop }
}

async function main() {
  const runtimeBin = join(RUNTIME, 'apps', 'cli', 'lib', 'bin.js')
  const builtWriter = join(DIST_ROOT, 'runtime', 'review-assignment', 'writer.js')
  const builtDomain = join(DIST_ROOT, 'storage', 'repositories', 'team-domain.js')
  if (!existsSync(runtimeBin)) {
    log(`DSH-PRI1A-REALHOST verdict=env-refused reason=no-materialized-runtime path=${relative(WORKTREE, runtimeBin)} recipe="TEST_METHODS §2: clone --local --no-hardlinks, checkout --detach ${TEST_USE_BASELINE_SHA}, install, build"`)
    process.exitCode = 3
    return
  }
  if (!existsSync(builtWriter) || !existsSync(builtDomain)) {
    log(`DSH-PRI1A-REALHOST verdict=env-refused reason=no-built-artifacts writer=${existsSync(builtWriter)} team-domain=${existsSync(builtDomain)} recipe="pnpm build"`)
    process.exitCode = 3
    return
  }

  const laneHead = gitOut(['rev-parse', 'HEAD'], WORKTREE)
  const hostHead = gitOut(['rev-parse', 'HEAD'], RUNTIME)
  const hostPorcelainBefore = porcelainCount(RUNTIME)
  log(`lane head=${laneHead}; host head=${hostHead} (pin ${TEST_USE_BASELINE_SHA}); host porcelain before=${hostPorcelainBefore}`)
  check('host-is-the-pinned-baseline', hostHead === TEST_USE_BASELINE_SHA && hostPorcelainBefore === 0,
    `host HEAD ${hostHead} vs pin ${TEST_USE_BASELINE_SHA}, porcelain ${hostPorcelainBefore}`)

  // ── The enable surface, asked of the artifact that ships (in-process C1 + a C0 census; NOT a boot leg) ──
  // PR #517 §9.6 hands PR-I1b an obligation phrased as "default-off, and non-enabling teams byte-identical",
  // which pictures a switch a team can be flipped across. Two questions decide whether such a switch exists.
  // (a) The row's config channel is the only input a row gets, and `validateTeamPluginConfig` is the closed gate
  // in front of it: if it accepts an enable key and hands it through unchanged, nothing downstream honours it.
  // (b) Census: does any module in the shipped tree even NAME such a field? Both arms are measurements with
  // their grade named, and neither is offered as a Host pass — the live-host arm of this same question is
  // PR-I1b's instrument, and this kit cites it rather than duplicating it.
  let enableAnswer = 'not measured'
  try {
    const builtRow = await import(new URL(`file://${join(DIST_ROOT, 'runtime', 'src', 'plugin', 'host.js')}`))
    const frozenRowConfig = {
      rootSessionId: ROOT_SESSION, bootPhase: 'create', blueprintSource: 'x', seedMembers: [], generation: 1,
      staticModel: { provider: 'p', model: 'm' }, deniedSelection: null, mcpServers: [], mcpServer: null,
      environmentFacts: [], externalPolicyFacts: { hard: {}, capabilityExists: {} },
      glueUrl: 'file:///x.mjs', seamUrl: 'file:///y.mjs',
    }
    let honoured
    try {
      const returned = builtRow.validateTeamPluginConfig({ ...frozenRowConfig, feature: 'on', assignmentFeature: 'on' })
      honoured = true
      enableAnswer = `validateTeamPluginConfig ACCEPTED the enable keys and handed them through unchanged (feature=${JSON.stringify(returned?.feature)}, assignmentFeature=${JSON.stringify(returned?.assignmentFeature)})`
    } catch (error) {
      honoured = false
      enableAnswer = `validateTeamPluginConfig REFUSED the enable keys: ${String(error?.message).slice(0, 180)}`
    }
    const census = spawnSync('grep', ['-rl', '-E', 'assignmentFeature', '--include=*.ts', '--include=*.mjs',
      join(WORKTREE, 'packages')], { encoding: 'utf8' })
    const hits = (census.stdout ?? '').trim().split('\n').filter((l) => l !== '' && !l.includes('/dist/'))
    // One falsifiable predicate, not one that passes under either answer: an enable surface exists iff the
    // channel carries the key AND something in the shipped tree reads it. Refusing the key, or carrying a key
    // nobody reads, both mean "no switch" — and this leg goes RED the day a reader appears, which is the whole
    // point of measuring it instead of asserting it.
    check('enable-surface-is-not-a-host-switch', !(honoured && hits.length > 0),
      `C1+C0: ${enableAnswer}; and ${String(hits.length)} file(s) under packages/** outside dist name the key${hits.length > 0 ? ` (${hits.slice(0, 4).join(', ')})` : ''} → ${honoured && hits.length > 0 ? 'a reader exists, the A/B IS expressible and the "default-off" wording stands' : 'no path from any host surface to the writer, so no default-off/enabled A/B exists to be graded'}`)
    log(`INFO enable-surface for the record — ${enableAnswer}`)
  } catch (error) {
    refuse('enable-surface-is-not-a-host-switch', `the built row module did not import: ${String(error?.message).slice(0, 160)}`)
  }

  let port = PORT_OVERRIDE
  if (port !== null && (FORBIDDEN_PORTS.has(port) || await portInUse(port))) {
    log(`requested port ${port} unusable; falling back to the candidate list`)
    port = null
  }
  if (port === null) {
    for (const p of PORT_CANDIDATES) {
      if (FORBIDDEN_PORTS.has(p)) continue
      if (!(await portInUse(p))) { port = p; break }
      log(`port ${p} busy, trying next`)
    }
  }
  if (port === null) {
    log('DSH-PRI1A-REALHOST verdict=env-refused reason=no-free-port-in-318x-family')
    process.exitCode = 3
    return
  }
  const restartPort = PORT_CANDIDATES.find((p) => p !== port && !FORBIDDEN_PORTS.has(p)) ?? port

  /** What the raw-disk leg found, kept for the capture. */
  let diskEvidence = { scanned: 0, hits: {} }
  const home = join(HOMES, `${RUN_STAMP}-write`)
  if (existsSync(home) && readdirSync(home).length > 0) {
    log(`DSH-PRI1A-REALHOST verdict=env-refused reason=world-not-empty path=${relative(WORKTREE, home)}`)
    process.exitCode = 3
    return
  }
  const report1 = join(home, 'probe-write.json')
  const report2 = join(home, 'probe-restart.json')

  let host1 = null
  let host2 = null
  let boot1Log = ''
  let boot2Log = ''
  let booted = true
  try {
    // ── Boot 1: write the family through the shipped writer, on the host's real medium ──────────────────
    host1 = await bootWorld({ label: 'write', port, mode: 'write', home, reportPath: report1 })
    check('boot-1-reached-the-public-gate', host1.authStatus === 303 && host1.hasCookie,
      `GET /?token= -> ${host1.authStatus}, cookie ${host1.hasCookie ? 'issued' : 'ABSENT'} (token scrubbed)`)
    const r1 = host1.report
    if (r1 === null) {
      booted = false
      refuse('boot-1-wrote-the-family', 'the probe produced no report within 120s; the host log tail is in the evidence')
    } else {
      const step1 = (id) => r1.steps?.find((s) => s.id === id) ?? null
      check('boot-1-probe-completed', r1.state === 'done', `probe state=${r1.state} detail=${String(r1.detail)}`)
      check('boot-1-writer-wrote-created', step1('write-created')?.ok === true, String(step1('write-created')?.measured))
      check('boot-1-replay-answers-already-in-process', step1('replay-same-command')?.ok === true,
        String(step1('replay-same-command')?.measured))
      check('boot-1-writer-wrote-transferred-and-retired',
        step1('write-transferred')?.ok === true && step1('write-retired')?.ok === true,
        `${String(step1('write-transferred')?.measured)} ;; ${String(step1('write-retired')?.measured)}`)
      check('boot-1-generation-advanced-per-write', step1('generation-advanced-per-write')?.ok === true,
        String(step1('generation-advanced-per-write')?.measured))
      check('boot-1-three-rows-in-real-ledger', step1('rows-in-real-ledger')?.ok === true, String(step1('rows-in-real-ledger')?.measured))
      check('boot-1-lock-was-serialised', (r1.lock?.acquires ?? 0) === 4 && (r1.lock?.peak ?? 0) === 1,
        `lock acquires=${String(r1.lock?.acquires)} peak depth=${String(r1.lock?.peak)} (one critical section at a time)`)
      const w = r1.writes ?? {}
      check('boot-1-sequence-chain-is-1-2-3', [w.created?.sequence, w.transferred?.sequence, w.retired?.sequence].join(',') === '1,2,3',
        `sequences created=${String(w.created?.sequence)} transferred=${String(w.transferred?.sequence)} retired=${String(w.retired?.sequence)}`)
    }
    const s1 = await host1.stop()
    boot1Log = s1.logText
    check('boot-1-stopped-and-port-free', !s1.alive && s1.free, `process ${s1.alive ? 'STILL ALIVE' : 'stopped'}, port ${port} ${s1.free ? 'free' : 'STILL BOUND'}`)

    // ── Leg 3: the bytes on disk, read by THIS process after the host is gone ───────────────────────────
    // Only files the HOST wrote count. The probe's own report and the host log both carry the fact-type
    // strings as prose; scanning them would make this leg pass on the probe's own words — a gate that cannot
    // fail. Everything this kit wrote is excluded by name.
    const own = new Set(['probe-write.json', 'probe-restart.json', 'host-write.log', 'host-restart.log'])
    const worldFiles = filesUnder(home).filter((f) => {
      const rel = relative(home, f)
      return !own.has(rel) && !rel.startsWith(join('profiles'))
    })
    const hitFiles = {}
    for (const fact of FACT_TYPES) {
      hitFiles[fact] = []
      for (const f of worldFiles) {
        if (!existsSync(f)) continue
        const text = readFileSync(f).toString('latin1')
        const hits = text.split(fact).length - 1
        if (hits > 0) hitFiles[fact].push({ file: relative(home, f), hits })
      }
    }
    const totalHits = FACT_TYPES.reduce((n, f) => n + hitFiles[f].reduce((m, h) => m + h.hits, 0), 0)
    const missing = FACT_TYPES.filter((f) => hitFiles[f].length === 0)
    const hitList = FACT_TYPES.flatMap((f) => hitFiles[f].map((h) => `${h.file}=${String(h.hits)}`))
    diskEvidence = { scanned: worldFiles.length, hits: hitFiles }
    check('durable-bytes-exist-in-world-files', missing.length === 0 && totalHits >= 3,
      `${String(totalHits)} occurrence(s) of the three fact types in host-written files (${hitList.join(', ') || 'none'})${missing.length === 0 ? '' : `; MISSING ${missing.join(', ')}`}; ${String(worldFiles.length)} host file(s) scanned after the host process exited`)

    // ── Boot 2: a SECOND process over the SAME world reopens and folds what boot 1 wrote ────────────────
    host2 = await bootWorld({ label: 'restart', port: restartPort, mode: 'restart', home, reportPath: report2 })
    const r2 = host2.report
    if (r2 === null) {
      refuse('boot-2-reopened-the-medium', 'the restart probe produced no report within 120s')
    } else {
      const step2 = (id) => r2.steps?.find((s) => s.id === id) ?? null
      check('boot-2-probe-completed', r2.state === 'done', `probe state=${r2.state} detail=${String(r2.detail)}`)
      check('boot-2-reopened-in-a-fresh-process', step2('domain-reopened-fresh-process')?.ok === true,
        String(step2('domain-reopened-fresh-process')?.measured))
      check('boot-2-rows-survived-the-restart', step2('rows-survived-restart')?.ok === true, String(step2('rows-survived-restart')?.measured))
      const same = JSON.stringify(r1?.rows ?? null) === JSON.stringify((r2.rows ?? []).slice(0, 3))
      check('boot-2-rows-are-boot-1-rows', r1 !== null && same,
        same ? 'the three rows read in the fresh process are identical to the three boot 1 wrote'
          : `boot1=${JSON.stringify(r1?.rows ?? null).slice(0, 200)} boot2=${JSON.stringify((r2.rows ?? []).slice(0, 3)).slice(0, 200)}`)
      check('boot-2-generation-is-durable', step2('generation-durable')?.ok === true
        && r2.generation === r1?.generation?.after,
        `generation ${String(r2.generation)} in the fresh process vs ${String(r1?.generation?.after)} at the end of boot 1`)
      check('boot-2-replay-after-restart-answers-already-at-original-sequence', step2('replay-after-restart-answers-already')?.ok === true
        && r2.replayFirst?.sequence === r1?.writes?.created?.sequence,
        `${String(step2('replay-after-restart-answers-already')?.measured)}; original sequence ${String(r1?.writes?.created?.sequence)}`)
      check('boot-2-replay-wrote-nothing', step2('replay-wrote-nothing')?.ok === true, String(step2('replay-wrote-nothing')?.measured))
      check('boot-2-new-family-continues-the-chain', step2('new-family-writes-after-restart')?.ok === true,
        String(step2('new-family-writes-after-restart')?.measured))
    }
    const s2 = await host2.stop()
    boot2Log = s2.logText
    check('boot-2-stopped-and-port-free', !s2.alive && s2.free,
      `process ${s2.alive ? 'STILL ALIVE' : 'stopped'}, port ${restartPort} ${s2.free ? 'free' : 'STILL BOUND'}`)
  } catch (error) {
    booted = false
    check('instrument-completed', false, `${error?.name ?? 'Error'}: ${scrub(error?.message ?? String(error))}`)
  } finally {
    for (const host of [host1, host2]) {
      if (host === null) continue
      try {
        const s = await host.stop()
        if (s.alive) log(`${host.label}: teardown left the process alive; marker ${host.marker} must be killed by hand`)
      } catch { /* already stopped */ }
    }
    const survivors = [host1, host2].filter((h) => h !== null).map((h) => h.port)
    for (const p of [...new Set([...survivors, port, restartPort])]) {
      const bound = await portInUse(p)
      log(`port-check ${p} ${bound ? 'BOUND' : 'free'}`)
    }
    if (!KEEP_WORLD) {
      rmSync(home, { recursive: true, force: true })
      const left = existsSync(HOMES) ? readdirSync(HOMES).filter((n) => !n.startsWith('.')) : []
      check('worlds-torn-down', left.length === 0, left.length === 0 ? 'tests/homes/ is empty again' : `left behind: ${left.join(', ')}`)
    } else {
      log(`--keep-world: world left at ${relative(WORKTREE, home)}`)
    }
    const hostPorcelainAfter = porcelainCount(RUNTIME)
    check('host-tree-stayed-pristine', hostPorcelainAfter === 0, `host porcelain after=${hostPorcelainAfter}`)
  }

  const failed = results.filter((r) => r.verdict === 'FAIL')
  const refused = results.filter((r) => r.verdict === 'REFUSED')
  const passed = results.filter((r) => r.verdict === 'PASS')
  const verdict = failed.length > 0 ? 'fail' : refused.length > 0 ? 'refused' : booted ? 'pass' : 'refused'

  const verdictLine = `DSH-PRI1A-REALHOST verdict=${verdict} pass=${String(passed.length)} fail=${String(failed.length)} refused=${String(refused.length)} legs=${String(results.length)}` +
    (failed.length > 0 ? ` failed=${failed.map((r) => r.id).join(',')}` : '') +
    (refused.length > 0 ? ` refusedlegs=${refused.map((r) => r.id).join(',')}` : '')
  // The verdict line goes into the transcript BEFORE the transcript is written, so a stamped directory carries
  // its own grade: an evidence file that only lists PASS/FAIL rows and never states the run's verdict leaves the
  // reader to recompute it, and a recomputed verdict is an assertion again.
  log(verdictLine)

  const stampDir = join(EVIDENCE_ROOT, RUN_STAMP)
  mkdirSync(stampDir, { recursive: true })
  writeFileSync(join(stampDir, 'MEASURED-LINES.txt'), lines.map(scrub).join('\n') + '\n')
  writeFileSync(join(stampDir, 'capture.json'), JSON.stringify({
    runStamp: RUN_STAMP, laneHead, hostHead, hostPorcelainBefore, hostPorcelainAfter: porcelainCount(RUNTIME),
    runtime: { baseline: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    ports: { write: port, restart: restartPort }, world: relative(WORKTREE, home), keepWorld: KEEP_WORLD,
    rootSessionId: ROOT_SESSION, approvalCaseId: CASE_ID,
    disk: diskEvidence, enableSurface: enableAnswer,
    checks: results,
    probe: { write: host1?.report ?? null, restart: host2?.report ?? null },
  }, null, 2).replace(/([?&]token=)[^&#\s"']*/g, '$1<REDACTED>') + '\n')
  // The host's own logs are read inside stop(), BEFORE the world is deleted; the world is disposable, the
  // transcript of what the host said while it was alive is the evidence.
  if (boot1Log !== '') writeFileSync(join(stampDir, 'host-write.log'), scrub(boot1Log))
  if (boot2Log !== '') writeFileSync(join(stampDir, 'host-restart.log'), scrub(boot2Log))
  log(`evidence: ${relative(WORKTREE, stampDir)} (the verdict line above is inside MEASURED-LINES.txt)`)
  process.exitCode = verdict === 'pass' ? 0 : 1
}

main().catch((error) => {
  log(`DSH-PRI1A-REALHOST verdict=crash ${scrub(error?.stack ?? String(error))}`)
  process.exitCode = 1
})
