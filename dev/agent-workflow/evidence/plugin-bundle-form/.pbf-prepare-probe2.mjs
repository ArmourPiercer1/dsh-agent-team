#!/usr/bin/env node
// pbf-prepare-probe2.mjs — R127 execution 1, round 2:
//
//   S1b: a root `prepare` that itself runs a nested `pnpm install` — does it
//        recurse? (count marker lines; 60s hang guard via spawnSync timeout)
//   S2b: which local-bare-repo dependency SPEC form does pnpm 11.7.0 accept
//        on this Windows machine (the user's flow is a git-hosted add)?
//   S3b: with the working spec: git dep installs, prepare blocked by
//        default, allowlisted key unblocks it.
//
// Exit 0 when all match expectation.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { join } from 'node:path'

const BASE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.pbf-prepare-probe2'
const env = { ...process.env, CI: 'true' }

function run(cwd, args, { timeoutMs = 120000, cmd = 'pnpm' } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    timeout: timeoutMs,
  })
  return {
    ok: r.status === 0,
    timedOut: r.signal === 'SIGTERM' || r.status === 124 || /ETIMEDOUT|timeout/i.test(String(r.error ?? '')),
    out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ?? ''}`,
  }
}

rmSync(BASE, { recursive: true, force: true })
let pass = true
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) pass = false
}

// ---- S1b: nested-install prepare recursion --------------------------------
{
  const repo = join(BASE, 'repo-nested')
  mkdirSync(join(repo, 'packages/a'), { recursive: true })
  writeFileSync(
    join(repo, 'package.json'),
    JSON.stringify({
      name: 'probe-nested',
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: {
        prepare:
          "node -e \"require('fs').appendFileSync('prepare-ran.txt','root\\n')\" && pnpm install",
      },
    }, null, 1) + '\n',
  )
  writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
  writeFileSync(
    join(repo, 'packages/a/package.json'),
    JSON.stringify({ name: '@probe/a', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n',
  )
  const r = run(repo, ['install'], { timeoutMs: 90000 })
  const runs = existsSync(join(repo, 'prepare-ran.txt'))
    ? readFileSync(join(repo, 'prepare-ran.txt'), 'utf8').split('\n').filter(Boolean).length
    : 0
  check(
    'S1b nested-install prepare does not recurse (completes, <=1 run)',
    r.ok && !r.timedOut && runs === 1,
    `ok=${r.ok} timedOut=${r.timedOut} runs=${runs} out-tail=${JSON.stringify(r.out.slice(-250))}`,
  )
}

// ---- S2b: find a working local bare-repo spec ------------------------------
const probeRepo = join(BASE, 'probe-src')
mkdirSync(join(probeRepo, 'packages/a'), { recursive: true })
writeFileSync(
  join(probeRepo, 'package.json'),
  JSON.stringify({
    name: 'probe-root',
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: { prepare: "node -e \"require('fs').appendFileSync('prepare-ran.txt','root\\n')\"" },
  }, null, 1) + '\n',
)
writeFileSync(join(probeRepo, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
writeFileSync(
  join(probeRepo, 'packages/a/package.json'),
  JSON.stringify({ name: '@probe/a', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n',
)
writeFileSync(join(probeRepo, 'README.md'), 'probe\n')
run(probeRepo, ['init', '-q', '-b', 'main'], { cmd: 'git' })
run(probeRepo, ['add', '-A'], { cmd: 'git' })
run(probeRepo, ['-c', 'user.email=p@p', '-c', 'user.name=p', 'commit', '-qm', 'probe'], { cmd: 'git' })
const bare = join(BASE, 'probe.git')
run(BASE, ['clone', '-q', '--bare', probeRepo, bare], { cmd: 'git' })

const consumer = join(BASE, 'consumer')
mkdirSync(consumer, { recursive: true })
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'probe-consumer', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n',
)
writeFileSync(join(consumer, 'pnpm-workspace.yaml'), '')

const bareFs = bare.replace(/\\/g, '/')
const specCandidates = [
  `git+file://${bareFs}`, // three slashes, drive colon kept
  `file://${bareFs}`,
  bare, // raw path to a .git dir
  `git+${bareFs}`,
]
let spec = null
for (const candidate of specCandidates) {
  const r = run(consumer, ['add', candidate], { timeoutMs: 90000 })
  const installed = existsSync(join(consumer, 'node_modules', 'probe-root'))
  console.log(`S2b candidate ${JSON.stringify(candidate)}: ok=${r.ok} installed=${installed} tail=${JSON.stringify(r.out.slice(-160))}`)
  if (r.ok && installed) {
    spec = candidate
    break
  }
  // reset consumer state between attempts
  run(consumer, ['remove', 'probe-root'], { timeoutMs: 60000 })
  rmSync(join(consumer, 'node_modules'), { recursive: true, force: true })
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'probe-consumer', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n')
  writeFileSync(join(consumer, 'pnpm-workspace.yaml'), '')
}
check('S2b a working local bare-repo spec exists', spec !== null, `spec=${spec}`)

// ---- S3b: blocked by default, then allowlisted ------------------------------
if (spec !== null) {
  // fresh consumer (the successful add above left state)
  rmSync(consumer, { recursive: true, force: true })
  mkdirSync(consumer, { recursive: true })
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'probe-consumer', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n')
  writeFileSync(join(consumer, 'pnpm-workspace.yaml'), '')
  const addOut = run(consumer, ['add', spec]).out
  const depDir = join(consumer, 'node_modules', 'probe-root')
  const installed = existsSync(depDir)
  const marker = existsSync(join(depDir, 'prepare-ran.txt'))
  check('S3b default: dep installed, prepare NOT run', installed && !marker, `installed=${installed} marker=${marker} tail=${JSON.stringify(addOut.slice(-260))}`)
  // discover the printed allowlist key
  const keyMatch = /Ignored build scripts:?\s*([\w@./-]+)/i.exec(addOut)
  const key = keyMatch?.[1] ?? 'probe-root'
  writeFileSync(join(consumer, 'pnpm-workspace.yaml'), `allowBuilds:\n  ${key}: true\n`)
  const reinstOut = run(consumer, ['install']).out
  const marker2 = existsSync(join(depDir, 'prepare-ran.txt'))
  check('S3b allowlisted: prepare runs on re-install', marker2, `key=${key} out-tail=${JSON.stringify(reinstOut.slice(-260))}`)
}

console.log(pass ? 'PASS pbf-prepare-probe2' : 'FAIL pbf-prepare-probe2')
process.exit(pass ? 0 : 1)
