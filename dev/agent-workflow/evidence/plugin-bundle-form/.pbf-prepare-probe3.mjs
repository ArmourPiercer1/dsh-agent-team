#!/usr/bin/env node
// pbf-prepare-probe3.mjs — R127 execution 1, round 3 (DECISIVE):
//
//   S4: prepare = `marker && pnpm install --ignore-scripts && marker2`.
//       Does the nested --ignore-scripts install re-trigger the root prepare?
//       Expectation: prepare runs EXACTLY ONCE (root=1, post=1), completes,
//       and the workspace deps are still LINKED (node_modules populated) —
//       i.e. --ignore-scripts skips lifecycle scripts but still installs.
//
// This is the crux of the plugin-bundle-form design: the root prepare must
// be `pnpm install --ignore-scripts && pnpm build && pnpm build:composition`
// (NOT a bare `pnpm install`, which recurses 17x per probe2).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.pbf-prepare-probe3'
const env = { ...process.env, CI: 'true' }

function run(cwd, args, { timeoutMs = 180000, cmd = 'pnpm' } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true, timeout: timeoutMs,
  })
  return { ok: r.status === 0, timedOut: r.signal === 'SIGTERM', out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ?? ''}` }
}

rmSync(BASE, { recursive: true, force: true })
const repo = join(BASE, 'repo')
mkdirSync(join(repo, 'packages/a'), { recursive: true })

let pass = true
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) pass = false
}

writeFileSync(
  join(repo, 'package.json'),
  JSON.stringify({
    name: 'probe-ig',
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      prepare:
        "node -e \"require('fs').appendFileSync('prepare-ran.txt','root\\n')\" && pnpm install --ignore-scripts && node -e \"require('fs').appendFileSync('prepare-ran.txt','post\\n')\"",
    },
  }, null, 1) + '\n',
)
writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n')
writeFileSync(
  join(repo, 'packages/a/package.json'),
  JSON.stringify({
    name: '@probe/a',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: { 'is-odd': '^3.0.1' },
  }, null, 1) + '\n',
)

const r = run(repo, ['install'], { timeoutMs: 180000 })
const markerPath = join(repo, 'prepare-ran.txt')
const txt = existsSync(markerPath) ? readFileSync(markerPath, 'utf8') : ''
const rootRuns = txt.split('root\n').length - 1
const postRuns = txt.split('post\n').length - 1
const nmRoot = existsSync(join(repo, 'node_modules')) ? readdirSync(join(repo, 'node_modules')).length : 0
const depLinked =
  existsSync(join(repo, 'node_modules', '.pnpm')) ||
  existsSync(join(repo, 'node_modules', 'is-odd')) ||
  existsSync(join(repo, 'packages/a/node_modules', 'is-odd'))

check('S4 completes without timeout', r.ok && !r.timedOut, `ok=${r.ok} timedOut=${r.timedOut}`)
check('S4 prepare runs EXACTLY once (no recursion)', rootRuns === 1 && postRuns === 1, `root=${rootRuns} post=${postRuns}`)
check('S4 deps still linked under --ignore-scripts', depLinked || nmRoot > 0, `depLinked=${depLinked} nmRoot=${nmRoot}`)
console.log(`S4 out-tail=${JSON.stringify(r.out.slice(-300))}`)

console.log(pass ? 'PASS pbf-prepare-probe3' : 'FAIL pbf-prepare-probe3')
process.exit(pass ? 0 : 1)
