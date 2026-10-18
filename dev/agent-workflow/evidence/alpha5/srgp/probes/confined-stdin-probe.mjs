/**
 * confined-stdin-probe.mjs — the two facts the search row depends on:
 *   (1) rg's stdin heuristic BLOCKS a confined `--json` run whose stdin is an
 *       open pipe (measured: no bytes, no exit, until the row's timeout);
 *       closing it (`child.stdin.end()`) gives EOF and the run completes.
 *   (2) upward ignore discovery inside the confine speaks on stderr
 *       (`…/.git: Permission denied`), so the row's fixed argv pins
 *       `--no-ignore-parent` (selection-neutral on this fixture: the row's
 *       governed root is its own ignore scope).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const HERE = dirnameOf(fileURLToPath(import.meta.url))
function dirnameOf(p) { return p.slice(0, p.lastIndexOf('/')) }
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const W = join(REPO, 'tests/homes', `a5srgp-cprobe-${Date.now().toString(36)}`)
const ROOT = join(W, 'root')
mkdirSync(join(ROOT, 'src'), { recursive: true })
writeFileSync(join(ROOT, 'src', 'a.ts'), 'hello A5SRGP-TOK\n')
const { createConfinedProcessProvider } = await import(join(REPO, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js'))
const p = createConfinedProcessProvider({ realmId: 'x', trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`, scratchRoot: join(W, 'scratch'), assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 } })
const probe = await p.probe()
console.log('probe.ok =', probe.ok === true)
const rx = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const allow = [rx('/bin'), rx('/usr'), rx('/lib'), rx(RG.slice(0, RG.lastIndexOf('/'))), { path: ROOT, accessBits: { readFile: true, readDir: true } }]
const run = async (tag, argv, cwd, closeStdin) => {
  const h = await p.spawnStreaming({ grantFingerprint: 'g', realmId: 'x', bindingId: 'b', memberScope: 'm', argv: [...argv], cwd, env: [['PATH', '/usr/bin:/bin']], allowPaths: allow })
  if (h.ok !== true) { console.log(tag, 'SPAWN-REFUSED', JSON.stringify(h.error).slice(0, 200)); return }
  const c = h.value
  if (closeStdin) c.stdin.end()
  let out = ''
  let err = ''
  c.stdout.on('data', (d) => { out += String(d) })
  c.stderr.on('data', (d) => { err += String(d) })
  const ex = await Promise.race([c.exited, sleep(15_000).then(() => ({ timedOut: true }))])
  await c.terminate()
  console.log(`${tag} | closeStdin=${String(closeStdin)} code=${String(ex?.code)} timedOut=${String(ex?.timedOut === true)} outBytes=${String(out.length)} errBytes=${String(err.length)} err=${JSON.stringify(err.slice(0, 120))}`)
}
await run('S1-json-open-stdin', [RG, '--no-config', '--json', '--regexp=A5SRGP-TOK'], ROOT, false)
await sleep(100)
await run('S2-json-closed-stdin', [RG, '--no-config', '--json', '--regexp=A5SRGP-TOK'], ROOT, true)
await sleep(100)
await run('S3-json-closed-no-ignore-parent', [RG, '--no-config', '--json', '--regexp=A5SRGP-TOK', '--no-ignore-parent'], ROOT, true)
await sleep(100)
await run('S4-invalid-closed', [RG, '--no-config', '--json', '--regexp=('], ROOT, true)
await sleep(100)
await run('S5-files-default-ignore', [RG, '--no-config', '--files'], ROOT, true)
rmSync(W, { recursive: true, force: true })
