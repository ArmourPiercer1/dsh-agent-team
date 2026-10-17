/**
 * W-PTC-OUTER realm probe (PR#290 review comment 6230116007, legs ①/② at OS caliber).
 *
 * What this is: the host's OWN built PTC child entry —
 *   <test-use>/packages/ptc-runtime/ptc-runtime-node/lib/process.js
 * (the package's PUBLIC `./process` export, `main` of the child side) — booted by
 * this kit over the host's OWN inherited control channel:
 *   fd 7 + env marker DSH_SUBPROCESS_CONTROL=pipe  (subprocess/src/control.ts),
 *   length-prefixed JSON frames (4-byte BE length + UTF-8 body, channel.ts),
 *   handshake ready → {type:'boot', data:{code, namespaces, maxOutputBytes}} → log/done.
 * Child argv is the host's own shape (`launch.ts` / `index.ts`):
 *   [node, --max-old-space-size=<N>, <process.js>, <maxMessageBytes>].
 *
 * Two arms, same program, same argv:
 *   unconfined  — the realm exactly as the host hands it over when the file policy
 *                 is disabled (index.ts: `policy.mode === 'danger-full-access' ? undefined
 *                 : await this.ctx.sandbox.confine(...)`), i.e. what the outer program
 *                 can reach when nothing wraps it. This is also the REACHABLE CONTROL
 *                 arm: the allowed in-workspace write must really happen.
 *   confined    — the identical child execve'd by the TRACKED trusted pre-launcher
 *                 (`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`,
 *                 `--confined-exec`, P1 entry self-lock) under a workspace-write-SHAPED
 *                 Landlock grant (read-only base + read/write on the session workspace
 *                 only). The grant mirrors the host's own profile shape
 *                 (`sandbox-local/src/profiles.ts` landlockProfileArgs: readOnly ['/'],
 *                 readWrite ['/dev/null','/tmp',workspace]) with the read base narrowed
 *                 to what node itself needs to boot.
 *
 * CALIBER (disclosed, never inflated):
 *   - plane = FIXTURE/OS: the realm and the enforcement are real (host's own child
 *     code + real Landlock ABI), but the launch does not go through ToolRuntime,
 *     the Team guard, or the host's own sandbox service. It answers "what does the
 *     OS actually refuse for the outer program", nothing about admission.
 *   - zero port bound, zero host instance, zero DSH_HOME writes; all effects land
 *     inside the run directory the runner hands in.
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-outer/probe-a5ptc3-realm
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt
}

const TESTUSE = arg('--testuse', '')
const LAUNCHER = arg('--launcher', '')
const PYTHON = arg('--python', 'python3')
const PATHS_FILE = arg('--paths', '')
const OUT = arg('--out-dir', '')
const ARMS = arg('--arms', 'unconfined,confined').split(',').map((s) => s.trim()).filter(Boolean)
const MAX_MESSAGE_BYTES = 8 * 1024 * 1024
const HEAP_MB = 512

const spec = JSON.parse(readFileSync(PATHS_FILE, 'utf8'))
const PROGRAM = readFileSync(spec.programFile, 'utf8')
mkdirSync(OUT, { recursive: true })

/** Drive one PTC child to completion over the inherited control channel. */
function driveChild({ argv, env, cwd, label, relayArgv }) {
  return new Promise((resolve) => {
    const stdio = ['ignore', 'pipe', 'pipe', 'ignore', 'ignore', 'ignore', 'ignore', 'pipe']
    const child = spawn(argv[0], argv.slice(1), { cwd, env, stdio })
    const control = child.stdio[7]
    let stdout = ''
    let stderr = ''
    let buf = Buffer.alloc(0)
    const frames = []
    const logs = []
    let done = null
    let ready = false
    let settled = false
    const finish = (why) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { control?.destroy() } catch { /* gone */ }
      try { child.kill() } catch { /* gone */ }
      resolve({ label, why, ready, frames: frames.slice(0, 60), logs, done, stdout: stdout.slice(0, 4000), stderr: stderr.slice(0, 4000), rc: exitCode, signal, exitWait })
    }
    const timer = setTimeout(() => finish('KIT-TIMEOUT'), 120_000)
    let exitCode = null
    let signal = null
    let exitWait = null
    child.stdout?.on('data', (c) => { stdout += c.toString('utf8') })
    child.stderr?.on('data', (c) => { stderr += c.toString('utf8') })
    child.on('error', (error) => { stderr += `\nspawn-error: ${String(error?.message ?? error)}` })
    child.on('exit', (code, sig) => { exitCode = code; signal = sig; exitWait = 'exited' })
    child.on('close', () => { exitWait = 'closed'; if (done !== null || ready) setTimeout(() => finish('child-closed'), 300) })
    if (control == null) { finish('no-control-fd7'); return }
    control.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      for (;;) {
        if (buf.length < 4) return
        const len = buf.readUInt32BE(0)
        if (buf.length < 4 + len) return
        const body = buf.subarray(4, 4 + len)
        buf = buf.subarray(4 + len)
        let msg = null
        try { msg = JSON.parse(body.toString('utf8')) } catch { msg = { type: 'unparseable' } }
        frames.push(msg?.type ?? 'unknown')
        if (msg?.type === 'ready') {
          ready = true
          const boot = { type: 'boot', data: { code: PROGRAM, namespaces: [], maxOutputBytes: 4 * 1024 * 1024 } }
          const bodyBytes = Buffer.from(JSON.stringify(boot), 'utf8')
          const header = Buffer.alloc(4)
          header.writeUInt32BE(bodyBytes.length)
          control.write(Buffer.concat([header, bodyBytes]))
        } else if (msg?.type === 'log') {
          logs.push(String(msg.text ?? ''))
        } else if (msg?.type === 'done') {
          done = msg
          setTimeout(() => finish('program-done'), 600)
        }
      }
    })
    control.on('error', (error) => { stderr += `\ncontrol-error: ${String(error?.message ?? error)}` })
    control.on('close', () => { if (done === null && !settled) setTimeout(() => finish('control-closed'), 400) })
    void relayArgv
  })
}

const frame = (msg) => {
  const body = Buffer.from(JSON.stringify(msg), 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32BE(body.length)
  return Buffer.concat([header, body])
}
void frame

/** Parse the program's own console.log line out of the log frames. */
function parseResult(logs) {
  for (const line of logs) {
    const i = line.indexOf('A5PTC3-BYPASS ')
    if (i < 0) continue
    try { return JSON.parse(line.slice(i + 'A5PTC3-BYPASS '.length)) } catch { /* keep looking */ }
  }
  return null
}

async function armUnconfined() {
  const argv = [process.execPath, `--max-old-space-size=${HEAP_MB}`, spec.childEntry, String(MAX_MESSAGE_BYTES)]
  const r = await driveChild({
    label: 'unconfined',
    argv,
    cwd: spec.workspace,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', DSH_SUBPROCESS_CONTROL: 'pipe' },
  })
  r.argv = argv
  r.programResult = parseResult(r.logs)
  return r
}

async function armConfined() {
  const argv = [process.execPath, `--max-old-space-size=${HEAP_MB}`, spec.childEntry, String(MAX_MESSAGE_BYTES)]
  // Landlock rights are per-path, not inherited by children of a path: every path the
  // child must REACH needs its own ancestor traversal (READ_DIR) plus the right on the
  // leaf itself. Nothing outside this set is reachable — the forbidden zone is
  // deliberately absent from it, which is what makes it a forbidden zone.
  const RO = { read_file: true, read_dir: true }
  const RW = { read_file: true, read_dir: true, write_file: true, make_reg: true, remove_file: true, truncate: true }
  const ancestors = (p) => {
    const out = []
    let cur = dirname(p)
    while (cur.length > 1) { out.push(cur); cur = dirname(cur) }
    out.push('/')
    return out
  }
  const reach = [process.execPath, spec.childEntry, spec.workspace, spec.rwScratch]
  const traversal = new Map()
  for (const p of reach) for (const dir of ancestors(p)) traversal.set(dir, { path: dir, bits: { read_dir: true } })
  // node resolves the nearest parent package.json by READING it: grant exactly those
  // files (no directory-wide read anywhere below the workspace).
  const configs = []
  for (const p of [spec.childEntry, process.execPath]) {
    let dir = dirname(p)
    for (;;) {
      const candidate = join(dir, 'package.json')
      if (existsSync(candidate)) configs.push({ path: candidate, bits: { read_file: true } })
      if (dir === '/') break
      dir = dirname(dir)
    }
  }
  const policy = {
    cwd: spec.workspace,
    argv,
    env: [['PATH', process.env.PATH ?? '/usr/bin:/bin'], ['DSH_SUBPROCESS_CONTROL', 'pipe']],
    runtime_base: true,
    close_extra_fds: true,
    fd_plan: { declared: [{ fd: 7 }] },
    allow: [
      ...traversal.values(),
      ...configs,
      { path: dirname(process.execPath), bits: { ...RO, execute: true } },
      { path: process.execPath, bits: { read_file: true, execute: true } },
      { path: dirname(spec.childEntry), bits: RO },
      { path: spec.childEntry, bits: { read_file: true } },
      { path: spec.workspace, bits: RW },
      { path: spec.rwScratch, bits: RW },
      { path: '/dev', bits: { read_file: true, read_dir: true, write_file: true } },
      { path: '/tmp', bits: { read_file: true, read_dir: true, write_file: true, make_reg: true, remove_file: true } },
    ],
  }
  const policyPath = join(OUT, `policy-${spec.run}.json`)
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n')
  const outDir = join(OUT, 'launcher-out')
  mkdirSync(outDir, { recursive: true })
  const launcherArgv = [PYTHON, LAUNCHER, '--confined-exec', '--policy', policyPath, '--out-dir', outDir]
  const r = await driveChild({ label: 'confined', argv: launcherArgv, cwd: spec.workspace, env: { PATH: process.env.PATH ?? '/usr/bin:/bin' } })
  r.argv = launcherArgv
  r.policy = policy
  let verdict = null
  try { verdict = JSON.parse(r.stdout.trim().split('\n').filter((l) => l.startsWith('{'))[0] ?? 'null') } catch { /* keep */ }
  r.launcherVerdict = verdict
  const childOut = verdict?.out_ref != null && existsSync(verdict.out_ref) ? readFileSync(verdict.out_ref, 'utf8') : ''
  const childErr = verdict?.err_ref != null && existsSync(verdict.err_ref) ? readFileSync(verdict.err_ref, 'utf8') : ''
  r.confinedChildStdout = childOut.slice(0, 4000)
  r.confinedChildStderr = childErr.slice(0, 4000)
  r.programResult = parseResult([...r.logs, childOut])
  return r
}

const abi = spawnSync(PYTHON, [LAUNCHER, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
const abiVerdict = (() => { try { return JSON.parse(abi.stdout.trim()) } catch { return { raw: abi.stdout, stderr: abi.stderr } } })()

const results = { run: spec.run, launcherSha: spawnSync('sha256sum', [LAUNCHER], { encoding: 'utf8' }).stdout.trim().split(/\s+/)[0], abi: abiVerdict, arms: {} }
for (const arm of ARMS) {
  results.arms[arm] = arm === 'confined' ? await armConfined() : await armUnconfined()
}
writeFileSync(join(OUT, `realm-${spec.run}.json`), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify({ run: spec.run, abi: abiVerdict.verdict ?? abiVerdict, arms: Object.fromEntries(Object.entries(results.arms).map(([k, v]) => [k, { why: v.why, rc: v.rc, ready: v.ready, done: v.done?.type ?? null, apiKeys: Object.keys(v.programResult?.api ?? {}), pid: v.programResult?.realm?.pid ?? null }])) }, null, 2))
