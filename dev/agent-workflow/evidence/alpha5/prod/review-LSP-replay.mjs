#!/usr/bin/env node
/**
 * review-LSP-replay — the INDEPENDENT P-LSP reviewer's replay kit.
 * Reviewer = qwen3.8-flash-next, an independent session (≠ the implementation
 * lane); subject = alpha5-prod-lsp @ 93b728a37a90112b39408d789bed484b5fcf3d12.
 * The payload below is the reviewer's OWN, not the lane's fixture.
 *
 * It drives the COMMITTED dist artifacts (the install face, not the TS sources)
 * over the REAL Landlock launcher and measures the claims under review:
 *
 *   L1  face keys             old entries intact + the two parallel-additive ones
 *   L2  provider streaming    real confined payload through the compiled seam:
 *                             handshake pid = payload OS pid, live-pipe round trip,
 *                             deny-path EACCES INSIDE the child, no inherited handle
 *   L2b fd-3 boundary         the launcher's fd 3 passed as a MARKER file: the
 *                             confined payload must not hold it (stream arm)
 *   L3a one-shot regression   NO fd 3 at all (the ruleset itself lands on 3): the
 *                             arm still executes — the exact shape a5p4 guards
 *   L3b one-shot + fd 3 given the arm executes and the payload does not hold the
 *                             launcher's channel
 *   L3c counterfactual        the PRE-FIX shape (unconditional fd-3 close) self-closes
 *                             its own ruleset -> rc 127: the timing guard is load-bearing
 *   L4  isolation             two members = two distinct confined pids, own pipes,
 *                             hot re-ensure adds no process
 *   L5  policyChange          the four LSP-DR requirements, production version, OS-probed
 *   L6  ensure mismatch       a generation change through `ensure` is REFUSED
 *   L7  mid-change failure    a LIVE half-built instance leaves ZERO residual pids
 *   L8  pre-gate              a wrong byte-pin refuses the new realm WITHOUT touching
 *                             the healthy old instance and creates ZERO processes
 *   L9  lease chain (real)    cancelling never self-settles; unconfirmed and
 *                             terminated are distinct, reached only via settleTermination
 *   L10 terminate escalation  a SIGTERM-ignoring confined child is escalated and
 *                             confirmed through /proc
 *   L11 teardown              disposeAll net-zero, world scan empty
 *
 * World: tests/homes/a5lsp2-rev-<stamp> (removed on teardown). No port is bound.
 *
 * @module dev/agent-workflow/evidence/alpha5/prod/review-LSP-replay
 */
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..', '..')
const dist = join(repoRoot, 'packages/runtime/dist/packages/runtime/sandbox-provider')
const launcherPath = join(repoRoot, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const payloadSrc = join(here, 'review-LSP-probe-payload.mjs')

const { createConfinedProcessProvider, createLspRealmAssembly, compileFdPlan, fdPlanToPayload } =
  await import(`file://${join(dist, 'index.js')}`)

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pidAlive = (pid) => {
  try {
    return readdirSync('/proc').includes(String(pid))
  } catch {
    return false
  }
}
async function pollUntil(fn, deadlineMs, everyMs = 25) {
  const t0 = Date.now()
  for (;;) {
    if (fn()) return Date.now() - t0
    if (Date.now() - t0 >= deadlineMs) return null
    await sleep(everyMs)
  }
}
const nodeBin = globalThis.process.execPath
const nodeDir = dirname(nodeBin)
const MARKER = `HANDSHAKE-MARKER-${Math.random().toString(36).slice(2)}`

const world = join(repoRoot, 'tests/homes', `a5lsp2-rev-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(world, { recursive: true })
const probeDir = join(world, 'probes')
mkdirSync(probeDir, { recursive: true })
copyFileSync(payloadSrc, join(probeDir, 'probe.mjs'))
const forbidden = join(world, 'forbidden')
mkdirSync(forbidden, { recursive: true })
const secretPath = join(forbidden, 'secret.txt')
writeFileSync(secretPath, 'A5LSP2-REV-DENY-WORD\n')
const markerPath = join(forbidden, 'fd3-marker')
writeFileSync(markerPath, `${MARKER}\n`)

/** Reviewer's residue scan: live processes tied to THIS world, split by role. */
function scanWorld() {
  const found = []
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    let cmd = ''
    let cwd = ''
    try {
      cmd = readFileSync(`/proc/${entry}/cmdline`, 'utf8').replace(/\0/g, ' ').trim()
    } catch {
      continue
    }
    try {
      cwd = readFileSync(`/proc/${entry}/cwd`, 'utf8')
    } catch {
      /* unreadable — not one of ours */
    }
    if (!(cmd.includes(world) || cwd.startsWith(world))) continue
    const kind = cmd.includes('landlock-prelauncher.py') ? 'supervisor' : cmd.includes('probe.mjs') ? 'payload' : 'other'
    found.push({ pid: Number(entry), kind, cwd, cmd: cmd.slice(0, 140) })
  }
  return found
}

function policyFor(member, generation, mode = '') {
  const genRoot = join(world, 'ws', `${member}-${generation}`)
  mkdirSync(genRoot, { recursive: true })
  const argv = [nodeBin, join(probeDir, 'probe.mjs'), generation, secretPath, markerPath]
  if (mode.length > 0) argv.push(mode)
  return {
    grantFingerprint: `sha256:rev-${member}-${generation}`,
    bindingId: `binding-rev-${member}`,
    argv,
    cwd: genRoot,
    env: [['PATH', '/usr/bin:/bin']],
    allowPaths: [
      { path: nodeDir, accessBits: { execute: true, readFile: true, readDir: true } },
      { path: probeDir, accessBits: { readFile: true, readDir: true } },
      { path: genRoot, accessBits: { readFile: true, readDir: true } },
    ],
  }
}

/** The launcher policy document shape, mirrored from prepare() for direct legs. */
function launcherPolicy(p) {
  return {
    argv: [...p.argv],
    cwd: p.cwd,
    env: p.env.map(([k, v]) => [k, v]),
    runtime_base: true,
    allow: p.allowPaths.map((a) => ({
      path: a.path,
      bits: {
        execute: a.accessBits.execute === true, write_file: a.accessBits.writeFile === true,
        read_file: a.accessBits.readFile === true, read_dir: a.accessBits.readDir === true,
        remove_file: a.accessBits.removeFile === true, make_reg: a.accessBits.makeReg === true,
        truncate: a.accessBits.truncate === true,
      },
    })),
    fd_plan: fdPlanToPayload(compileFdPlan([]).plan),
    close_extra_fds: true,
  }
}

const LAUNCHER_SHA = createHash('sha256').update(readFileSync(launcherPath)).digest('hex')
const ASSEMBLY = { launcherPath, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 }

async function roundTrip(handle, seq, timeoutMs = 25_000) {
  return new Promise((resolveP, rejectP) => {
    let buf = ''
    const onData = (chunk) => {
      buf += String(chunk)
      for (;;) {
        const nl = buf.indexOf('\n')
        if (nl < 0) return
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line.startsWith('{')) continue
        let parsed
        try {
          parsed = JSON.parse(line)
        } catch {
          continue
        }
        if (parsed.pong === seq) {
          clearTimeout(timer)
          handle.stdout.off('data', onData)
          resolveP(parsed)
          return
        }
      }
    }
    const timer = setTimeout(() => {
      handle.stdout.off('data', onData)
      rejectP(new Error(`round-trip ${seq} timed out`))
    }, timeoutMs)
    handle.stdout.on('data', onData)
    handle.stdin.write(`{"ping":${seq}}\n`)
  })
}

const firstLine = (stream, timeoutMs = 25_000) =>
  new Promise((res) => {
    let buf = ''
    const onData = (c) => {
      buf += String(c)
      const nl = buf.indexOf('\n')
      if (nl < 0) return
      clearTimeout(t)
      stream.off('data', onData)
      try {
        res(JSON.parse(buf.slice(0, nl)))
      } catch {
        res(null)
      }
    }
    const t = setTimeout(() => {
      stream.off('data', onData)
      res(null)
    }, timeoutMs)
    stream.on('data', onData)
  })

const journal = []
let exitCode = 0
let assembly = null

try {
  // ---- L1 face keys -------------------------------------------------------
  const provider0 = createConfinedProcessProvider({
    realmId: 'rev-face', trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher', scratchRoot: world,
  })
  const keys = Object.keys(provider0).sort()
  const historical = ['execute', 'prepare', 'probe', 'requestCancellation', 'settleTermination', 'spawn']
  check('L1 old API keys intact (6 historical ⊆ face)', historical.every((k) => keys.includes(k)), keys.join(','))
  check('L1 streaming entries added in parallel', keys.includes('spawnStreaming') && keys.includes('executeStreaming'))

  // ---- L2 the compiled streaming seam over a REAL confined payload --------
  const revProvider = createConfinedProcessProvider({
    realmId: 'rev-l2', trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher', scratchRoot: world, assembly: ASSEMBLY,
  })
  const p2 = policyFor('R1', 'g0')
  const spawned = await revProvider.spawnStreaming({
    grantFingerprint: p2.grantFingerprint, realmId: 'rev-l2', bindingId: p2.bindingId, memberScope: 'member/R1',
    argv: p2.argv, cwd: p2.cwd, env: p2.env, allowPaths: p2.allowPaths,
  })
  check('L2 spawnStreaming ok on the compiled install face', spawned.ok === true, spawned.ok ? `pid=${spawned.value.pid}` : JSON.stringify(spawned.error))
  if (spawned.ok) {
    const h = spawned.value
    const first = await firstLine(h.stdout)
    const inWorld = Array.isArray(first?.extra) ? first.extra.filter((e) => typeof e.target === 'string' && e.target.startsWith(world)) : ['no-sample']
    check('L2 the confined payload holds NO handle into the launcher/world bookkeeping', inWorld.length === 0, JSON.stringify({ extra: first?.extra }))
    check('L2 the payload cannot read the launcher fd-3 marker file by name', first?.markerVisible === 'EACCES', `markerVisible=${first?.markerVisible}`)
    check('L2 deny-path read is EACCES inside the confined child', first?.denied === 'EACCES', `denied=${first?.denied}`)
    check('L2 handshake pid IS the payload OS pid', first?.pid === h.pid, `child=${first?.pid} seam=${h.pid}`)
    check('L2 payload cwd IS the generation root', first?.cwd === p2.cwd, String(first?.cwd))
    const rt = await roundTrip(h, 11)
    check('L2 bidirectional round-trip answers on the live pipes', rt.pong === 11 && rt.pid === h.pid)
    const settled = await h.terminate({ graceMs: 1_000, deadlineMs: 12_000 })
    const goneMs = settled.ok ? await pollUntil(() => !pidAlive(h.pid), 6_000) : null
    check('L2 terminate settles terminated with /proc proof', settled.ok === true && settled.value.status === 'terminated' && goneMs !== null, `status=${settled.ok ? settled.value.status : JSON.stringify(settled.error)} goneAfterMs=${goneMs}`)
  }

  // ---- L2b the fd-3 channel as a MARKER file (direct stream arm) -----------
  const p2b = policyFor('FD3', 'g0')
  const policyPathStream = join(world, 'policy-fd3-stream.json')
  writeFileSync(policyPathStream, JSON.stringify(launcherPolicy(p2b)))
  const streamDir = join(world, 'stream-direct')
  mkdirSync(streamDir, { recursive: true })
  const markerFd = openSync(markerPath, 'r+')
  let directSupervisorPid = 0
  const direct = await new Promise(async (res) => {
    const child = spawn('python3', [launcherPath, '--confined-exec-stream', '--policy', policyPathStream, '--out-dir', streamDir], {
      stdio: ['pipe', 'pipe', 'pipe', markerFd],
    })
    directSupervisorPid = child.pid ?? 0
    const facts = await firstLine(child.stdout, 25_000)
    child.stdin.write('{"method":"exit"}\n')
    const code = await new Promise((r) => child.once('exit', (c, s) => r({ code: c, signal: s })))
    res({ facts, code })
  })
  closeSync(markerFd)
  const markerBytes = readFileSync(markerPath, 'utf8')
  const fd3Target = String(direct.facts?.fd3?.target ?? '')
  const fd3Read = String(direct.facts?.fd3?.read ?? '')
  check('L2b the launcher really used the fd-3 channel (handshake written to it)', /"stream":\s*true/.test(markerBytes), markerBytes.replace(/\n/g, '\\n').slice(0, 120))
  check('L2b stream arm: the fd-3 channel never reaches the confined payload', fd3Target !== markerPath && !fd3Read.includes(MARKER), `fd3=${JSON.stringify(direct.facts?.fd3)}`)
  check('L2b stream arm: the payload ran CONFINED anyway (deny-path EACCES)', direct.facts?.denied === 'EACCES', `denied=${direct.facts?.denied}`)
  const exitRecord = (() => {
    try {
      return JSON.parse(readFileSync(join(streamDir, 'exit.json'), 'utf8'))
    } catch {
      return null
    }
  })()
  check('L2b stream arm: exit.json records the SAME pid the handshake reported', exitRecord?.pid === direct.facts?.pid, `exit.json=${JSON.stringify(exitRecord)} payloadPid=${direct.facts?.pid}`)
  const supervisorGone = await pollUntil(() => !pidAlive(directSupervisorPid), 8_000)
  check('L2b stream arm: the supervisor exits once the payload exits (bounded, never orphaned)', directSupervisorPid > 0 && supervisorGone !== null && direct.code.code === 0, `supervisor=${directSupervisorPid} goneAfterMs=${supervisorGone} exit=${JSON.stringify(direct.code)}`)

  // ---- L3a/L3b/L3c the one-shot arm + the counterfactual -------------------
  const oneShotDir = join(world, 'oneshot')
  mkdirSync(oneShotDir, { recursive: true })
  const policyPath3 = join(world, 'policy-oneshot.json')
  writeFileSync(policyPath3, JSON.stringify(launcherPolicy(p2b)))
  const runOneShot = (launcher, outDir, shape) => {
    const stdio = shape === 'marker'
      ? ['pipe', 'pipe', 'pipe', openSync(markerPath, 'r+')]
      : ['pipe', 'pipe', 'pipe']
    try {
      return spawnSync('python3', [launcher, '--confined-exec', '--policy', policyPath3, '--out-dir', outDir], {
        stdio, input: '{"method":"exit"}\n', timeout: 60_000, encoding: 'utf8',
      })
    } finally {
      if (shape === 'marker') closeSync(stdio[3])
    }
  }
  const lastJson = (text) => {
    try {
      return JSON.parse(String(text).trim().split('\n').filter(Boolean).pop())
    } catch {
      return null
    }
  }
  const readOut = (dir) => {
    try {
      return lastJson(readFileSync(join(dir, 'out'), 'utf8'))
    } catch {
      return null
    }
  }
  const osPlain = runOneShot(launcherPath, join(oneShotDir, 'out-plain'), 'none')
  const answerPlain = lastJson(osPlain.stdout)
  const outPlain = readOut(join(oneShotDir, 'out-plain'))
  check('L3a one-shot arm executes with NO fd 3 at all (the ruleset itself lands on 3)', answerPlain?.executed === true && answerPlain?.rc === 0, `launcherRc=${osPlain.status} answer=${JSON.stringify(answerPlain)}`)
  check('L3a one-shot payload confined (deny-path EACCES) and cannot read the marker by name', outPlain?.denied === 'EACCES' && outPlain?.markerVisible === 'EACCES', `denied=${outPlain?.denied} markerVisible=${outPlain?.markerVisible}`)

  const osMarker = runOneShot(launcherPath, join(oneShotDir, 'out-marker'), 'marker')
  const answerMarker = lastJson(osMarker.stdout)
  const outMarker = readOut(join(oneShotDir, 'out-marker'))
  check('L3b one-shot arm executes with fd 3 inherited', answerMarker?.executed === true && answerMarker?.rc === 0, `answer=${JSON.stringify(answerMarker)}`)
  check('L3b one-shot payload does NOT hold the launcher fd-3 marker', String(outMarker?.fd3?.target ?? '') !== markerPath && !String(outMarker?.fd3?.read ?? '').includes(MARKER), `fd3=${JSON.stringify(outMarker?.fd3)}`)

  // L3d [NOTE-level measurement] the fd-plan law is 'close-all-UNDECLARED': a
  // policy that DECLARES fd 3 says that channel must survive into the payload.
  // The launcher-owned reservation closes it anyway (launcher line 375 one-shot,
  // hs_close on the stream arm), so a declared fd 3 is silently overridden.
  const declaredPolicy = launcherPolicy(p2b)
  declaredPolicy.fd_plan = { inheritDefault: 'close-all-undeclared', declared: [{ fd: 3, purpose: 'delivery' }] }
  const policyPathDeclared = join(world, 'policy-declared-fd3.json')
  writeFileSync(policyPathDeclared, JSON.stringify(declaredPolicy))
  const declaredFd3MarkerFd = openSync(markerPath, 'r+')
  const osDeclared = spawnSync('python3', [launcherPath, '--confined-exec', '--policy', policyPathDeclared, '--out-dir', join(oneShotDir, 'out-declared-fd3')], {
    stdio: ['pipe', 'pipe', 'pipe', declaredFd3MarkerFd], input: '{"method":"exit"}\n', timeout: 60_000, encoding: 'utf8',
  })
  closeSync(declaredFd3MarkerFd)
  const outDeclared = readOut(join(oneShotDir, 'out-declared-fd3'))
  const declaredFd3Held = String(outDeclared?.fd3?.target ?? '') === markerPath || String(outDeclared?.fd3?.read ?? '').includes(MARKER)
  check('L3d [note measured] a policy that DECLARES fd 3 does NOT get it: the launcher-owned reservation overrides the declaration',
    !declaredFd3Held && answerMarker?.rc === 0, `declared-fd-3-survived=${declaredFd3Held} payload-fd3=${JSON.stringify(outDeclared?.fd3)}`)

  const buggySrc = readFileSync(launcherPath, 'utf8')
  const fixedBlock = '    try:\n        os.fstat(HANDSHAKE_FD)\n        reserve = {HANDSHAKE_FD}  # the stream channel never crosses into the payload, even on the one-shot arm\n    except OSError:\n        reserve = set()\n'
  if (!buggySrc.includes(fixedBlock)) throw new Error('L3c anchor not found: the launcher changed shape, the counterfactual must be re-anchored')
  const preFix = buggySrc.replace(fixedBlock, '    reserve = {HANDSHAKE_FD}  // PRE-FIX SHAPE: unconditional close, no timing guard\n'.replace('//', '#'))
  const buggyPath = join(oneShotDir, 'launcher-prefix-shape.py')
  writeFileSync(buggyPath, preFix)
  const osBuggy = runOneShot(buggyPath, join(oneShotDir, 'out-prefix-shape'), 'none')
  const answerBuggy = lastJson(osBuggy.stdout)
  check('L3c PRE-FIX shape self-closes its own ruleset with no fd 3 (rc 127) — the timing guard is load-bearing',
    answerBuggy?.executed === true && answerBuggy?.rc === 127,
    `launcherRc=${osBuggy.status} answer=${JSON.stringify(answerBuggy)}`)
  const osBuggyMarker = runOneShot(buggyPath, join(oneShotDir, 'out-prefix-shape-fd3'), 'marker')
  const answerBuggyMarker = lastJson(osBuggyMarker.stdout)
  check('L3c the pre-fix shape only broke the no-fd-3 shape (with a real fd 3 it ran)', answerBuggyMarker?.executed === true && answerBuggyMarker?.rc === 0, `answer=${JSON.stringify(answerBuggyMarker)}`)

  // ---- L4..L11 the assembly lifecycle, production version -----------------
  assembly = createLspRealmAssembly({
    assembly: ASSEMBLY,
    trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher',
    scratchRoot: world,
    journal: (e) => journal.push(e),
    readyTimeoutMs: 20_000,
    terminateGraceMs: 1_500,
    terminateDeadlineMs: 12_000,
    policyFor: (member, generation) => policyFor(member, generation, generation === 'gSILENT' ? 'silent' : ''),
  })

  const a0 = await assembly.ensure('A', 'g0')
  const b0 = await assembly.ensure('B', 'g0')
  check('L4 two members = two distinct confined pids', a0.ok === true && b0.ok === true && a0.value.pid !== b0.value.pid, `A=${a0.ok ? a0.value.pid : 'x'} B=${b0.ok ? b0.value.pid : 'y'}`)
  if (a0.ok && b0.ok) {
    const pa = await roundTrip(a0.value.handle, 1)
    const pb = await roundTrip(b0.value.handle, 2)
    check('L4 each member answers on its own pipes only', pa.pid === a0.value.pid && pb.pid === b0.value.pid && pa.gen === 'g0' && pb.gen === 'g0', `A:${pa.pid}/${pa.gen} B:${pb.pid}/${pb.gen}`)
    const hot = await assembly.ensure('A', 'g0')
    check('L4 hot re-ensure reuses the same instance (no second process)', hot.ok === true && hot.value.pid === a0.value.pid)

    const mismatch = await assembly.ensure('A', 'gX')
    check('L6 ensure on a generation mismatch is REFUSED', mismatch.ok === false && mismatch.error?.code === 'IO_POLICY_UNSUPPORTED', JSON.stringify(mismatch.ok ? null : mismatch.error))
    check('L6 the refusal leaves the live instance untouched', assembly.current('A')?.pid === a0.value.pid)

    const oldPid = a0.value.pid
    const siblingPid = b0.value.pid
    journal.length = 0
    const changed = await assembly.policyChange('A', 'g1')
    check('L5 policyChange A g0→g1 ok with a NEW pid', changed.ok === true && changed.value.pid !== oldPid, changed.ok ? `old=${oldPid} new=${changed.value.pid}` : JSON.stringify(changed.error))
    const goneAfter = changed.ok ? await pollUntil(() => !pidAlive(oldPid), 12_000) : null
    check('L5 (req 1) old OS pid exits, bounded, /proc-probed', goneAfter !== null, `goneAfterMs=${goneAfter}`)
    if (changed.ok) {
      const p1 = await roundTrip(changed.value.handle, 3)
      check('L5 (req 2) the new instance answers with the NEW generation and its own cwd', p1.gen === 'g1' && p1.pid === changed.value.pid && p1.cwd === policyFor('A', 'g1').cwd, `gen=${p1.gen} cwd=${p1.cwd}`)
    }
    check('L5 (req 3) the sibling keeps its pid and stays hot', assembly.current('B')?.pid === siblingPid && pidAlive(siblingPid))
    const pbAfter = await roundTrip(assembly.current('B').handle, 4)
    check('L5 (req 3) the sibling still answers after A rebuilt', pbAfter.pid === siblingPid)
    const liveAfter = scanWorld()
    const payloadsAfter = liveAfter.filter((p) => p.kind === 'payload').map((p) => p.pid).sort((x, y) => x - y)
    const expectedPids = changed.ok ? [siblingPid, changed.value.pid].sort((x, y) => x - y) : [siblingPid]
    check('L5 (req 4) the ONLY live confined payloads are the rebuilt member and the sibling', JSON.stringify(payloadsAfter) === JSON.stringify(expectedPids), `payloads=${JSON.stringify(payloadsAfter)} expected=${JSON.stringify(expectedPids)}`)
    check('L5 (req 4) no orphan supervisor (exactly one per live instance)', liveAfter.filter((p) => p.kind === 'supervisor').length === expectedPids.length, `supervisors=${liveAfter.filter((p) => p.kind === 'supervisor').length}`)
    check('L5 (req 4) no live process carries the OLD generation root as cwd', !liveAfter.some((p) => p.cwd === policyFor('A', 'g0').cwd))
    check('L5 journal = the LSP-DR ledger, exact sequence', journal.map((e) => e.kind).join(',') === 'policy-change-begin,realm-disposed,realm-assembled,policy-change-complete', journal.map((e) => e.kind).join(','))
    const disposedEv = journal.find((e) => e.kind === 'realm-disposed')
    check('L5 the ledger names the disposed pid and a bounded dispose time', disposedEv?.lastPid === oldPid && typeof disposedEv?.disposeMs === 'number', JSON.stringify(disposedEv))

    const broken = createLspRealmAssembly({
      assembly: { launcherPath, launcherSha256: '0'.repeat(64), minAbiVersion: 3 },
      trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher', scratchRoot: world,
      policyFor: (member, generation) => policyFor(member, generation),
    })
    const healthyBefore = assembly.current('A')?.pid
    const liveBeforeGate = scanWorld().length
    const brokenFirst = await broken.ensure('C', 'g0')
    const brokenChange = await broken.policyChange('C', 'g1')
    check('L8 a wrong byte-pin refuses assemble AND policyChange (typed SANDBOX_UNAVAILABLE)',
      brokenFirst.ok === false && brokenChange.ok === false && brokenFirst.error?.code === 'SANDBOX_UNAVAILABLE' && brokenChange.error?.code === 'SANDBOX_UNAVAILABLE')
    check('L8 the healthy assembly is untouched by the gated one', assembly.current('A')?.pid === healthyBefore && pidAlive(healthyBefore))
    check('L8 the gated assembly created ZERO processes (live sample unchanged)', scanWorld().length === liveBeforeGate, `before=${liveBeforeGate} after=${scanWorld().length}`)

    const aLivePid = assembly.current('A')?.pid
    const silent = await assembly.policyChange('A', 'gSILENT')
    check('L7 mid-change (never-ready) failure returns a typed refusal', silent.ok === false && silent.error?.code === 'IO_POLICY_UNSUPPORTED', JSON.stringify(silent.ok ? null : silent.error))
    const oldGone = aLivePid !== undefined && (await pollUntil(() => !pidAlive(aLivePid), 12_000)) !== null
    check('L7 the old instance was disposed and is OS-gone', oldGone)
    check('L7 the member keeps NO dead handle (current = undefined)', assembly.current('A') === undefined)
    const residue2 = scanWorld()
    check('L7 ZERO residual pids/handles after the half-built failure (sibling only)',
      residue2.length === 2 && residue2.filter((p) => p.kind === 'payload').every((p) => p.pid === siblingPid) && residue2.filter((p) => p.kind === 'supervisor').length === 1,
      JSON.stringify(residue2.map((p) => `${p.kind}:${p.pid}`)))
    const stillHot = await roundTrip(assembly.current('B').handle, 5)
    check('L7 the sibling is untouched by the failed change', stillHot.pid === siblingPid)
    const readyEv = journal.filter((e) => e.kind === 'assemble-failed').pop()
    check('L7 the ledger records the ready-stage failure and the cleanup settle', readyEv?.stage === 'ready' && /cleanup settled/.test(String(readyEv?.detail)), JSON.stringify(readyEv))

    const leaseProvider = createConfinedProcessProvider({
      realmId: 'rev-lease', trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher', scratchRoot: world, assembly: ASSEMBLY,
    })
    const p9 = policyFor('L', 'g0')
    const s9 = await leaseProvider.spawnStreaming({
      grantFingerprint: p9.grantFingerprint, realmId: 'rev-lease', bindingId: p9.bindingId, memberScope: 'member/L',
      argv: p9.argv, cwd: p9.cwd, env: p9.env, allowPaths: p9.allowPaths,
    })
    if (s9.ok) {
      const cancelling = await leaseProvider.requestCancellation(s9.value.lease)
      check('L9 the cancellation REQUEST moves the lease to cancelling', cancelling.ok === true && cancelling.value.status === 'cancelling', cancelling.ok ? cancelling.value.status : JSON.stringify(cancelling.error))
      const goneAfterCancel = await pollUntil(() => !pidAlive(s9.value.pid), 15_000)
      check('L9 the confined process is actually gone', goneAfterCancel !== null, `afterMs=${goneAfterCancel}`)
      const recheck = await leaseProvider.requestCancellation(cancelling.value)
      check('L9 a gone process NEVER self-settles the lease (still cancelling)', recheck.ok === true && recheck.value.status === 'cancelling', recheck.ok ? recheck.value.status : JSON.stringify(recheck.error))
      const unconf = await leaseProvider.settleTermination(recheck.value, false)
      check('L9 settleTermination(false) = termination-unconfirmed (a real state)', unconf.ok === true && unconf.value.status === 'termination-unconfirmed')
      const conf = await leaseProvider.settleTermination(unconf.value, true)
      check('L9 settleTermination(true) is the only path to terminated', conf.ok === true && conf.value.status === 'terminated')
    } else {
      check('L9 lease-chain leg spawned', false, JSON.stringify(s9.error))
    }

    const escProvider = createConfinedProcessProvider({
      realmId: 'rev-esc', trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher', scratchRoot: world, assembly: ASSEMBLY,
    })
    const p10 = policyFor('E', 'g0', 'ignore-term')
    const s10 = await escProvider.spawnStreaming({
      grantFingerprint: p10.grantFingerprint, realmId: 'rev-esc', bindingId: p10.bindingId, memberScope: 'member/E',
      argv: p10.argv, cwd: p10.cwd, env: p10.env, allowPaths: p10.allowPaths,
    })
    if (s10.ok) {
      // wait until the child itself says hello: only THEN is its SIGTERM handler
      // installed, so a SIGTERM that kills it earlier proves nothing.
      const hello10 = await firstLine(s10.value.stdout)
      const t0 = Date.now()
      const settled10 = await s10.value.terminate({ graceMs: 400, deadlineMs: 10_000 })
      const took = Date.now() - t0
      const gone10 = await pollUntil(() => !pidAlive(s10.value.pid), 5_000)
      check('L10 a SIGTERM-ignoring confined child is escalated (grace honored) and confirmed', settled10.ok === true && settled10.value.status === 'terminated' && gone10 !== null && took >= 400 && took < 9_000, `hello=${hello10?.pid === s10.value.pid} tookMs=${took} status=${settled10.ok ? settled10.value.status : JSON.stringify(settled10.error)}`)
    } else {
      check('L10 escalation leg spawned', false, JSON.stringify(s10.error))
    }

    const all = await assembly.disposeAll()
    const goneAll = await pollUntil(() => !pidAlive(siblingPid), 12_000)
    const residueAll = await pollUntil(() => scanWorld().length === 0, 8_000)
    check('L11 disposeAll net-zero: every pid gone, world scan empty', all.ok === true && assembly.size() === 0 && goneAll !== null && residueAll !== null, `size=${assembly.size()} scanEmptyAfterMs=${residueAll}`)
  }
} catch (error) {
  check('kit completed without an unexpected throw', false, String(error && error.stack ? error.stack : error))
} finally {
  try {
    if (assembly !== null) await assembly.disposeAll()
  } catch {
    /* best effort; the leftover report below still speaks */
  }
  const leftover = scanWorld()
  if (leftover.length > 0) console.log(`LEFTOVER in ${world}: ${JSON.stringify(leftover)}`)
  rmSync(world, { recursive: true, force: true })
  const failed = results.filter((r) => !r.ok)
  console.log(`REVIEW-REPLAY: ${results.length - failed.length}/${results.length} PASS`)
  exitCode = failed.length === 0 ? 0 : 1
}
process.exit(exitCode)
