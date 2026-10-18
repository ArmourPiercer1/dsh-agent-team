// what cwd does a confined child actually see?
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createConfinedProcessProvider } from '../../../../../../packages/runtime/dist/packages/runtime/sandbox-provider/provider.js'

const REPO = new URL('../../../../../../', import.meta.url).pathname
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5g7-cwdprobe-${Date.now().toString(36)}`)
const ROOT = join(WORLD, 'root')
mkdirSync(ROOT, { recursive: true })
const provider = createConfinedProcessProvider({
  realmId: 'cwd-probe',
  trustRoot: null,
  scratchRoot: join(WORLD, 'scratch'),
  assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 },
})
const h = await provider.spawnStreaming({
  grantFingerprint: 'cwd-probe:1',
  realmId: 'cwd-probe',
  bindingId: 'cwd-probe:b',
  memberScope: 'm',
  argv: ['/bin/sh', '-c', 'pwd; ls -a; exit 7'],
  cwd: ROOT,
  env: [['PATH', '/usr/bin:/bin']],
  allowPaths: [
    { path: '/bin', accessBits: { execute: true, readFile: true, readDir: true } },
    { path: '/usr', accessBits: { execute: true, readFile: true, readDir: true } },
    { path: '/lib', accessBits: { execute: true, readFile: true, readDir: true } },
    { path: ROOT, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } },
  ],
})
if (h.ok !== true) { console.log('SPAWN-REFUSED', JSON.stringify(h.error)); process.exit(1) }
let out = ''
let err = ''
h.value.stdout.on('data', (c) => { out += String(c) })
h.value.stderr.on('data', (c) => { err += String(c) })
const e = await h.value.exited
await h.value.terminate()
console.log('PWD-OUT:', JSON.stringify(out).slice(0, 300))
console.log('ERR:', JSON.stringify(err).slice(0, 200), 'exit=', e.code)
console.log('EXPECTED ROOT:', ROOT)
rmSync(WORLD, { recursive: true, force: true })
