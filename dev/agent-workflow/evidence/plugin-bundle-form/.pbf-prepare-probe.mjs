#!/usr/bin/env node
// pbf-prepare-probe.mjs — R127 execution 1: empirical probe of pnpm 11
// lifecycle-script semantics for the plugin-bundle-form design:
//
//   S1: `pnpm install` at a workspace ROOT does NOT run the root `prepare`
//       (dev-flow + 5-gate install safety: no recursion, no forced build).
//   S2: a git dependency's `prepare` is BLOCKED by default (pnpm >=10
//       behavior) with a printed allowlist key.
//   S3: allowlisting that key in the CONSUMER pnpm-workspace.yaml makes the
//       re-run execute `prepare` (the documented DSH CLI flow).
//
// Output: one line per scenario. Exit 0 when all three match expectation.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { join } from 'node:path'

const BASE = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.pbf-prepare-probe'
const env = { ...process.env, CI: 'true' }

function run(cwd, cmd, args) {
  try {
    // shell:true — pnpm resolves through its .cmd shim on Windows.
    return execFileSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true })
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`
  }
}

rmSync(BASE, { recursive: true, force: true })
mkdirSync(join(BASE, 'repo/packages/a'), { recursive: true })
const repo = join(BASE, 'repo')

// The probe "plugin" repo: root prepare + one workspace package prepare.
writeFileSync(
  join(repo, 'package.json'),
  JSON.stringify({
    name: 'probe-root',
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: { prepare: "node -e \"require('fs').appendFileSync('prepare-ran.txt','root\\n')\"" },
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
  }, null, 1) + '\n',
)
writeFileSync(join(repo, 'README.md'), 'probe\n')
run(repo, 'git', ['init', '-q', '-b', 'main'])
run(repo, 'git', ['add', '-A'])
run(repo, 'git', ['-c', 'user.email=p@p', '-c', 'user.name=p', 'commit', '-qm', 'probe'])
run(repo, 'git', ['clone', '-q', '--bare', repo, join(BASE, 'probe.git')])

const consumer = join(BASE, 'consumer')
mkdirSync(consumer, { recursive: true })

let pass = true
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) pass = false
}

// ---- S1: root workspace install — measure prepare runs (recursion check) -
const s1Out = run(repo, 'pnpm', ['install'])
const rootMarker = existsSync(join(repo, 'prepare-ran.txt'))
const rootRuns = rootMarker
  ? readFileSync(join(repo, 'prepare-ran.txt'), 'utf8').split('\n').filter(Boolean).length
  : 0
check('S1 root-install runs prepare at most once (no recursion)', rootRuns <= 1, `runs=${rootRuns}; out-tail=${JSON.stringify(s1Out.slice(-200))}`)
if (rootMarker) rmSync(join(repo, 'prepare-ran.txt'), { force: true })

// ---- S2: git dep prepare blocked by default ------------------------------
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'probe-consumer', version: '0.0.0', private: true, type: 'module' }, null, 1) + '\n',
)
writeFileSync(join(consumer, 'pnpm-workspace.yaml'), '')
const spec = `git+file://${join(BASE, 'probe.git').replace(/\\/g, '/')}`
const addOut = run(consumer, 'pnpm', ['add', spec])
console.log(`S2 full add output:\n${addOut}\n----`)
const depDir = join(consumer, 'node_modules', 'probe-root')
const s2installed = existsSync(depDir)
const s2marker = existsSync(join(depDir, 'prepare-ran.txt'))
check('S2 git-dep installs but prepare blocked by default', s2installed && !s2marker, `installed=${s2installed} marker=${s2marker}`)

// ---- S3: allowlisted key -> prepare runs on the next install --------------
// Discover the exact key pnpm printed (package name in the ignored-builds
// notice). Fallback: the dep package name.
const keyMatch = /Ignored build scripts?:?\s*([\w@./-]+)/i.exec(addOut)
const key = keyMatch?.[1] ?? 'probe-root'
writeFileSync(
  join(consumer, 'pnpm-workspace.yaml'),
  `allowBuilds:\n  ${key}: true\n`,
)
run(consumer, 'pnpm', ['install'])
const s3marker = existsSync(join(depDir, 'prepare-ran.txt'))
check('S3 allowlisted prepare executes', s3marker, `key=${key}`)

console.log(pass ? 'PASS pbf-prepare-probe' : 'FAIL pbf-prepare-probe')
process.exit(pass ? 0 : 1)
