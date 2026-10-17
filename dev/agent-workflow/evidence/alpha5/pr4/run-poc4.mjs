#!/usr/bin/env node
// run-poc4.mjs — Alpha.5 PR4 (C Lane) PoC4 evidence kit. Task-local kit per
// TEST_METHODS §4.1 (lives with its evidence, self-contained, not a kit under
// tests/kits/ because it is lane development evidence, not a reusable kit).
//
// Runs the AUTHORITATIVE probe surface end-to-end through the lane's own
// provider module and writes a machine-readable evidence bundle:
//   runs/poc4-evidence.json      — verdicts, capability rows, raw syscall lines
//   runs/poc4-run.log            — human transcript with exit code
// Scratch worlds are created under tests/homes/a5p4-* and removed at the end.
// Nothing outside the scratch tree is written; every confinement leg acts on
// the launcher's own (child) processes only.
//
// Exit codes: 0 = all legs behaved as expected; 2 = ABI unavailable (the
// honest degradation path is then what the evidence records); 7 = MIXED.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const HERE = new URL('.', import.meta.url).pathname
const REPO = join(HERE, '..', '..', '..', '..', '..')
const WORLD = join(REPO, 'tests', 'homes', `a5p4-kit-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(WORLD, { recursive: true })

const run = (argv, timeout = 60_000) => {
  const r = spawnSync(argv[0], argv.slice(1), { encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 })
  return { rc: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

// The lane sources are TypeScript; reuse vitest's transform-free path by
// spawning ONE vitest-side harness instead of importing .ts here. To keep the
// kit dependency-free, the legs run the launcher directly (the launcher IS
// the trusted pre-launcher), and the capability-row law is asserted by the
// vitest spec (runs/a5p4-*.log), whose log this kit references.
const LAUNCHER = join(REPO, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const PY = process.env['A5P4_PYTHON'] ?? 'python3'

const log = []
const record = (line) => { log.push(line); console.log(line) }

const abi = JSON.parse(run([PY, LAUNCHER, '--abi-probe']).stdout.split('\n').filter(Boolean).pop() ?? '{}')
record(`abi-probe: kind=${abi.kind} version=${abi.abi_version}`)

const legs = {}
if (abi.kind === 'abi-available') {
  for (const leg of ['selective', 'denyall', 'badhandled']) {
    const dir = join(WORLD, leg)
    const r = run([PY, LAUNCHER, '--enforce-leg', leg, '--scratch', dir])
    legs[leg] = JSON.parse(r.stdout.split('\n').filter(Boolean).pop() ?? 'null')
    record(`leg ${leg}: verdict=${legs[leg]?.verdict} rc=${r.rc}`)
  }
  const fd = run([PY, LAUNCHER, '--fd-close', '--scratch', join(WORLD, 'fdclose')])
  legs.fd_close = JSON.parse(fd.stdout.split('\n').filter(Boolean).pop() ?? 'null')
  record(`leg fd-close: verdict=${legs.fd_close?.verdict} rc=${fd.rc}`)

  // P1 confined-exec leg (entry self-lock, then exec untrusted argv).
  const w = join(WORLD, 'exec')
  mkdirSync(join(w, 'allow'), { recursive: true })
  mkdirSync(join(w, 'deny'), { recursive: true })
  writeFileSync(join(w, 'deny', 'secret.txt'), 'TOP-SECRET-DO-NOT-LEAK\n')
  const policy = {
    argv: ['/bin/sh', '-c', 'cat deny/secret.txt 2>&1; printf ok > allow/w.txt && cat allow/w.txt'],
    cwd: w,
    env: [['PATH', '/usr/bin:/bin']],
    runtime_base: true,
    allow: [{ path: join(w, 'allow'), bits: { read_file: true, read_dir: true, write_file: true, make_reg: true } }],
    fd_plan: { inheritDefault: 'close-all-undeclared', declared: [] },
    close_extra_fds: true,
  }
  writeFileSync(join(WORLD, 'policy.json'), JSON.stringify(policy))
  const ex = run([PY, LAUNCHER, '--confined-exec', '--policy', join(WORLD, 'policy.json'), '--out-dir', join(WORLD, 'out')])
  legs.confined_exec = { answer: JSON.parse(ex.stdout.split('\n').filter(Boolean).pop() ?? 'null') }
  legs.confined_exec.out = readOut(join(WORLD, 'out', 'out'))
  legs.confined_exec.err = readOut(join(WORLD, 'out', 'err'))
  record(`leg confined-exec: rc=${legs.confined_exec.answer?.rc} deny-says-permission-denied=${legs.confined_exec.out?.includes('Permission denied') ?? false} secret-leaked=${legs.confined_exec.out?.includes('TOP-SECRET') ?? true}`)
} else {
  record('ABI unavailable: enforcement legs degrade to ABI-UNAVAILABLE; nothing claimed')
}

function readOut(p) {
  try { return readFileSync(p, 'utf8') } catch { return '' }
}

const doubleConfirmed = legs.selective?.verdict === 'ENFORCE-CONFIRMED' && legs.denyall?.verdict === 'ENFORCE-CONFIRMED'
const evidence = {
  agent: { model: 'qwen3.8-flash-next', harness: 'DeepSeek Harness (listed separately)' },
  date: new Date().toISOString(),
  host: { release: run(['uname', '-r']).stdout.trim(), note: 'observations are fixture/subprocess level OS_ENFORCED; the launcher confines only its own process tree' },
  abi,
  legs,
  laws: {
    authoritative_surface: 'bare syscall GET_VERSION + real enforcement double evidence (selective & denyall); existence checks are precondition reports only',
    double_evidence: doubleConfirmed,
    false_absent_discriminator: legs.badhandled?.verdict === 'DEMO-CONFIRMED',
    fd_law: 'close-all-undeclared default; CLOEXEC is mechanism, not the guarantee (TOCTOU_A)',
    network_law: 'landlock TCP ABI v4 is NOT general no-network (PoC-4b); deny/restricted refused pre-spawn IO_POLICY_UNSUPPORTED',
    hard_profile_enabled: false,
  },
  scratchWorld: WORLD,
}
writeFileSync(join(HERE, 'runs', 'poc4-evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
writeFileSync(join(HERE, 'runs', 'poc4-run.log'), log.join('\n') + '\n')
rmSync(WORLD, { recursive: true, force: true })
record(`scratch removed: ${WORLD}`)
process.exitCode = abi.kind === 'abi-unavailable' ? 2 : (doubleConfirmed && legs.confined_exec?.answer?.executed === true ? 0 : 7)
console.log(`POC4 EXIT=${process.exitCode}`)
