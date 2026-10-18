/**
 * dot-arg-probe.mjs — why does a confined `rg --json … -- .` produce NOTHING?
 * The same argv through `/bin/sh -c` speaks, so the walk itself is visible.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync, readFileSync, utimesSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const W = join(REPO, 'tests/homes', `a5srgp-dot-${Date.now().toString(36)}`)
const ROOT = join(W, 'root')
const TOK = 'A5SRGP-TOK'
mkdirSync(join(ROOT, 'src'), { recursive: true })
for (const [rel, i] of [['src/a.ts', 0], ['src/b.ts', 1]]) {
  writeFileSync(join(ROOT, rel), `x ${TOK} ${rel}\n`)
  utimesSync(join(ROOT, rel), 1_600_000_000 + i, 1_600_000_000 + i)
}
const { createConfinedProcessProvider } = await import(join(REPO, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js'))
const p = createConfinedProcessProvider({ realmId: 'x', trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`, scratchRoot: join(W, 'scratch'), assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 } })
await p.probe()
const rx = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const allow = [rx('/bin'), rx('/usr'), rx('/lib'), rx(RG.slice(0, RG.lastIndexOf('/'))), { path: ROOT, accessBits: { readFile: true, readDir: true } }]
const run = async (tag, argv, opts = {}) => {
  const h = await p.spawnStreaming({ grantFingerprint: 'g', realmId: 'x', bindingId: 'b', memberScope: 'm', argv: [...argv], cwd: ROOT, env: [['PATH', '/usr/bin:/bin']], allowPaths: allow })
  if (h.ok !== true) { console.log(tag, 'SPAWN-REFUSED', JSON.stringify(h.error).slice(0, 160)); return }
  const c = h.value
  if (opts.closeStdin !== false) c.stdin.end()
  let out = ''
  let err = ''
  c.stdout.on('data', (d) => { out += String(d) })
  c.stderr.on('data', (d) => { err += String(d) })
  const ex = await Promise.race([c.exited, sleep(20_000).then(() => ({ timedOut: true }))])
  await c.terminate()
  console.log(`${tag} | code=${String(ex?.code)} signal=${String(ex?.signal)} to=${String(ex?.timedOut === true)} out(${String(out.length)})=${JSON.stringify(out.slice(0, 240))} err(${String(err.length)})=${JSON.stringify(err.slice(0, 240))}`)
}
await run('D1-direct-dot', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', '.'])
await sleep(120)
await run('D2-sh-dot', ['/bin/sh', '-c', `${RG} --no-config --json --regexp=${TOK} --no-ignore-parent -- . ; echo rc=$?`])
await sleep(120)
await run('D3-direct-no-dot', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent'])
await sleep(120)
await run('D4-sh-no-dot', ['/bin/sh', '-c', `${RG} --no-config --json --regexp=${TOK} --no-ignore-parent ; echo rc=$?`])
await sleep(120)
await run('D5-direct-files', [RG, '--no-config', '--files'])
await sleep(120)
await run('D6-direct-openstdin', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', '.'], { closeStdin: false })
rmSync(W, { recursive: true, force: true })
