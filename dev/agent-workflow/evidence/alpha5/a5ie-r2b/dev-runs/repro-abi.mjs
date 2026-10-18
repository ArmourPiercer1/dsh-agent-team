// Reproduce the confined provider's probe+prepare inside a plain node process,
// with the SAME assembly shape the kit passes, to see WHY the authoritative
// probe measured no landlock ABI inside the DSH host.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const WT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b'
const SCRATCH = join(WT, '.scratch-repro-abi')
mkdirSync(SCRATCH, { recursive: true })
const launcher = join(SCRATCH, 'landlock-prelauncher.py')
copyFileSync(join(WT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'), launcher)
const sha = createHash('sha256').update(readFileSync(launcher)).digest('hex')

const { createConfinedProcessProvider } = await import(join(WT, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js'))
const provider = createConfinedProcessProvider({
  realmId: 'repro-realm',
  trustRoot: `sha256:${sha.slice(0, 16)}#${launcher}`,
  scratchRoot: SCRATCH,
  assembly: { launcherPath: launcher, launcherSha256: sha, minAbiVersion: 3 },
})
const req = {
  argv: ['/bin/sh', '-c', 'echo REPRO-TOK'],
  realmId: 'repro-realm',
  cwd: SCRATCH,
  accesses: [{ path: '/bin', accessBits: { execute: true, readFile: true, readDir: true } }, { path: '/usr', accessBits: { execute: true, readFile: true, readDir: true } }, { path: '/lib', accessBits: { execute: true, readFile: true, readDir: true } }, { path: '/lib64', accessBits: { execute: true, readFile: true, readDir: true } }, { path: SCRATCH, accessBits: { readFile: true, writeFile: true, readDir: true } }],
}
const probed = await provider.probe()
console.log('PROBE ok=', probed.ok)
console.log('PROBE rows=', JSON.stringify(probed.ok ? probed.value : probed.error, null, 1).slice(0, 1400))
const prepared = await provider.prepare(req)
console.log('PREPARE', JSON.stringify(prepared).slice(0, 500))
if (prepared.ok) {
  const spawned = await provider.spawnStreaming(prepared.value).catch((e) => ({ threw: String(e) }))
  console.log('SPAWN', JSON.stringify(spawned).slice(0, 500))
}
// also: the raw python probe from THIS process
const r = spawnSync('python3', [launcher, '--abi-probe'], { encoding: 'utf8' })
console.log('RAW python3 probe rc=', r.status, 'stdout=', String(r.stdout).trim().slice(0, 200), 'err=', String(r.stderr).slice(0, 200))
console.log('PATH=', process.env.PATH.split(':').slice(0, 4).join(':'), 'A5P4_PYTHON=', process.env.A5P4_PYTHON ?? '(unset)')
