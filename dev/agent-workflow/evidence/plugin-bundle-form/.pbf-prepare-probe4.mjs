#!/usr/bin/env node
// pbf-prepare-probe4.mjs — R127 execution 1, round 4 (final lifecycle proof):
//
//   S5: git dep (working spec git+file:///D:/...) installed by DEFAULT:
//       prepare NOT run + capture pnpm's exact notice (the key the user
//       must allowlist).
//   S6: allowlist that key in the consumer pnpm-workspace.yaml → prepare
//       runs on the documented re-run (try `pnpm install`, then re-`add`,
//       then `pnpm rebuild`, whichever fires it — record which).
//   S7: dev-flow cost fact — does a NO-OP root `pnpm install` (2nd run,
//       everything up to date) run the root prepare again?
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

const BASE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.pbf-prepare-probe4'
const env = { ...process.env, CI: 'true' }

function run(cwd, args, { timeoutMs = 180000, cmd = 'pnpm' } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true, timeout: timeoutMs,
  })
  return { ok: r.status === 0, timedOut: r.signal === 'SIGTERM', out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ?? ''}` }
}

rmSync(BASE, { recursive: true, force: true })
let pass = true
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) pass = false
}

// ---- build the probe "plugin" repo (with prepare that leaves a marker) ----
const src = join(BASE, 'src')
{
  mkdirSync(src, { recursive: true })
  writeFileSync(
    join(src, 'package.json'),
    JSON.stringify({
      name: 'probe4-root',
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: {
        prepare:
          "node -e \"require('fs').appendFileSync('prepare-ran.txt','root\\n')\" && pnpm install --ignore-scripts",
      },
    }, null, 1) + '\n',
  )
  writeFileSync(join(src, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
  mkdirSync(join(src, 'packages/a'), { recursive: true })
  writeFileSync(
    join(src, 'packages/a/package.json'),
    JSON.stringify({ name: '@probe4/a', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n',
  )
  writeFileSync(join(src, 'README.md'), 'p4\n')
}
run(src, ['init', '-q', '-b', 'main'], { cmd: 'git' })
run(src, ['add', '-A'], { cmd: 'git' })
run(src, ['-c', 'user.email=p@p', '-c', 'user.name=p', 'commit', '-qm', 'p4'], { cmd: 'git' })
const bare = join(BASE, 'probe.git')
run(BASE, ['clone', '-q', '--bare', src, bare], { cmd: 'git' })
// Working Windows form (probe-verified): three slashes, drive colon kept.
const spec = `git+file:///${bare.replace(/\\/g, '/')}`

// ---- S5: default add — installed, prepare blocked --------------------------
const consumer = join(BASE, 'consumer')
mkdirSync(consumer, { recursive: true })
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'probe4-consumer', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n',
)
writeFileSync(join(consumer, 'pnpm-workspace.yaml'), '')
const addOut = run(consumer, ['add', spec]).out
const depDir = join(consumer, 'node_modules', 'probe4-root')
const depInstalled = existsSync(depDir)
const hardFail = addOut.includes('ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED')
check('S5 un-allowlisted git dep: add HARD-FAILS (not silently skipped)', hardFail && !depInstalled,
  `hardFail=${hardFail} depInstalled=${depInstalled}`)
// The EXACT allowBuilds key is the full `name@spec#commit` pnpm prints in
// its example (NOT the bare package name). Extract it robustly: the line
// immediately following the `allowBuilds:` example header.
let key = null
{
  const lines = addOut.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'allowBuilds:') {
      const nxt = (lines[i + 1] ?? '').trim()
      if (nxt.endsWith(': true')) key = nxt.slice(0, -': true'.length)
      break
    }
  }
}
console.log(`S5 allowlist key = ${JSON.stringify(key)}`)
check('S5 pnpm printed the full name@spec#commit allowBuilds key', key !== null && key.includes('@') && key.includes('#'))

// ---- S6: allowlist the exact key → re-run add → prepare fires ---------------
writeFileSync(join(consumer, 'pnpm-workspace.yaml'), `allowBuilds:\n  ${key}: true\n`)
let rAdd = run(consumer, ['add', spec])
const fired = existsSync(join(depDir, 'prepare-ran.txt'))
const installedAfter = existsSync(depDir)
check('S6 allowlisted re-add: install succeeds AND prepare ran', rAdd.ok && installedAfter && fired,
  `ok=${rAdd.ok} installed=${installedAfter} prepare=${fired} tail=${JSON.stringify(rAdd.out.slice(-200))}`)

// ---- S7: no-op root install — does it re-run the root prepare? --------------
{
  const dev = join(BASE, 'devroot')
  mkdirSync(join(dev, 'packages/a'), { recursive: true })
  writeFileSync(
    join(dev, 'package.json'),
    JSON.stringify({
      name: 'probe4-dev',
      version: '0.0.0',
      private: true,
      type: 'module',
      scripts: { prepare: "node -e \"require('fs').appendFileSync('prepare-ran.txt','root\\n')\"" },
    }, null, 1) + '\n',
  )
  writeFileSync(join(dev, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
  writeFileSync(
    join(dev, 'packages/a/package.json'),
    JSON.stringify({ name: '@probe4/a', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n',
  )
  run(dev, ['install'])
  const afterFirst = existsSync(join(dev, 'prepare-ran.txt'))
    ? readFileSync(join(dev, 'prepare-ran.txt'), 'utf8').split('\n').filter(Boolean).length
    : 0
  const r = run(dev, ['install'])
  const afterSecond = existsSync(join(dev, 'prepare-ran.txt'))
    ? readFileSync(join(dev, 'prepare-ran.txt'), 'utf8').split('\n').filter(Boolean).length
    : 0
  check('S7 no-op install prepare count measured (informational)', afterFirst >= 1 && afterSecond >= afterFirst,
    `first=${afterFirst} second=${afterSecond} (delta=${afterSecond - afterFirst} → prepare ${afterSecond - afterFirst > 0 ? 'RE-RUNS on every install' : 'does NOT re-run on no-op install'})`)
  console.log(`S7 second-install tail=${JSON.stringify(r.out.slice(-160))}`)
}

console.log(pass ? 'PASS pbf-prepare-probe4' : 'FAIL pbf-prepare-probe4')
process.exit(pass ? 0 : 1)
