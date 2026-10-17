// one-shot probe: does the confined rg surface exit=2 for an invalid glob?
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createAnchoredGlobBackend } from '../../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/plane-effect-backends.mjs'

const REPO = new URL('../../../../../../', import.meta.url).pathname
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const { createHash } = await import('node:crypto')
const SHA = createHash('sha256').update((await import('node:fs')).readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5g7-globprobe-${Date.now().toString(36)}`)
const ROOT = join(WORLD, 'root')
mkdirSync(join(ROOT, 'data'), { recursive: true })
writeFileSync(join(ROOT, 'data', 'needle.txt'), 'x\n')
const be = createAnchoredGlobBackend({
  realmId: 'probe-realm',
  rootDir: ROOT,
  confined: { trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`, assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 } },
  observe: (r) => console.log('OBS', r),
})
const io = { sink: null }
const bad = await be.run({ callId: 'probe-bad', parsedArgs: { tool: 'glob', pattern: '[unclosed', target: { placement: 'workspace', locator: '.' } } }, io)
console.log('BAD:', JSON.stringify(bad).slice(0, 400))
const good = await be.run({ callId: 'probe-good', parsedArgs: { tool: 'glob', pattern: '*.txt', target: { placement: 'workspace', locator: '.' } } }, io)
console.log('GOOD:', JSON.stringify(good).slice(0, 300))
import { symlinkSync } from 'node:fs'
const OUT = join(WORLD, 'outside')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'secret.txt'), 'A5G7-OUTSIDE-SECRET-42\n')
symlinkSync(OUT, join(ROOT, 'escape-link'))
const esc = await be.run({ callId: 'probe-esc', parsedArgs: { tool: 'glob', pattern: '*', target: { placement: 'relative', locator: 'escape-link' } } }, io)
console.log('ESC:', JSON.stringify(esc).slice(0, 400))
console.log('lastRuns:', JSON.stringify(be.lastRuns))
rmSync(WORLD, { recursive: true, force: true })
