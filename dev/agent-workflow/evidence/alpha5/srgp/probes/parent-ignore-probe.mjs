/**
 * parent-ignore-probe.mjs — the parent-ignore class, measured.
 *
 * Q1 does an unreadable PARENT ignore file (every parent is outside the
 *    confine, so it is always unreadable) steer selection in `--json` mode?
 * Q2 does it speak on stderr (which under the row's "the walker's speech is the
 *    error discriminator" law would refuse every governed search)?
 * Q3 is `--no-ignore-parent` selection-neutral, and does it silence Q2?
 * Q4 what does the NATIVE (unconfined) side do with a readable parent rule that
 *    ignores the whole search root — the honest parity difference to disclose.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const HERE = fileURLToPath(import.meta.url).replace(/\/[^/]*$/, '')
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const W = join(REPO, 'tests/homes', `a5srgp-parent-${Date.now().toString(36)}`)
// `ignored-by-parent/` is named to match the REPO's own .gitignore line
// `tests/homes/` — the world is inside the repo, so the parent rule really
// covers the search root: exactly the Q4 shape.
const ROOT = join(W, 'root')
mkdirSync(join(ROOT, 'src'), { recursive: true })
writeFileSync(join(ROOT, 'src', 'a.ts'), 'hello A5SRGP-TOK\n')
const nat = (argv, cwd) => {
  const r = spawnSync(RG, argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
  return { code: r.status, out: (r.stdout ?? '').split('\n').filter((l) => l.includes('"match"')).length, outRaw: (r.stdout ?? '').slice(0, 120), err: (r.stderr ?? '').slice(0, 200) }
}
console.log('Q4a native json default      ', JSON.stringify(nat(['--no-config', '--json', '--regexp=A5SRGP-TOK'], ROOT)))
console.log('Q4b native json no-ig-parent ', JSON.stringify(nat(['--no-config', '--json', '--regexp=A5SRGP-TOK', '--no-ignore-parent'], ROOT)))
console.log('Q4c native files default     ', JSON.stringify(nat(['--no-config', '--files'], ROOT)))

const { createConfinedProcessProvider } = await import(join(REPO, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js'))
const p = createConfinedProcessProvider({ realmId: 'x', trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`, scratchRoot: join(W, 'scratch'), assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 } })
await p.probe()
const rx = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const allow = [rx('/bin'), rx('/usr'), rx('/lib'), rx(RG.slice(0, RG.lastIndexOf('/'))), { path: ROOT, accessBits: { readFile: true, readDir: true } }]
const run = async (tag, argv) => {
  const h = await p.spawnStreaming({ grantFingerprint: 'g', realmId: 'x', bindingId: 'b', memberScope: 'm', argv: [...argv], cwd: ROOT, env: [['PATH', '/usr/bin:/bin']], allowPaths: allow })
  if (h.ok !== true) { console.log(tag, 'SPAWN-REFUSED'); return }
  const c = h.value
  c.stdin.end()
  let out = ''
  let err = ''
  c.stdout.on('data', (d) => { out += String(d) })
  c.stderr.on('data', (d) => { err += String(d) })
  const ex = await Promise.race([c.exited, sleep(20_000).then(() => ({ timedOut: true }))])
  await c.terminate()
  const matches = out.split('\n').filter((l) => l.includes('"match"')).length
  console.log(`${tag} | code=${String(ex?.code)} timedOut=${String(ex?.timedOut === true)} matches=${String(matches)} outFull=${JSON.stringify(out.slice(0, 500))} err=${JSON.stringify(err.slice(0, 1400))}`)
}
await run('Q1a confined json default   ', [RG, '--no-config', '--json', '--regexp=A5SRGP-TOK', '--debug'])
await sleep(100)
await run('Q2a confined files default  ', [RG, '--no-config', '--files'])
await sleep(100)
await run('Q3a confined json no-ig-par ', [RG, '--no-config', '--json', '--regexp=A5SRGP-TOK', '--no-ignore-parent'])
await sleep(100)
await run('Q3b confined files no-ig-par', [RG, '--no-config', '--files', '--no-ignore-parent'])
rmSync(W, { recursive: true, force: true })
