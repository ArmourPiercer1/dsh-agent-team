/**
 * dev-only: boot a host whose profile carries the abi-probe diagnostic row,
 * capture its stdout, and report. Prints the launcher/probe verdict as seen
 * INSIDE the host ambient.
 *
 * @module dev-runs/boot-abi-probe
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5ie-r2b'
const HOME = join(WT, 'tests', 'homes', 'a5ie-r2b-abiprobe')
const BIN = join(WT, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib', 'bin.js')
const SPEC = 'github:ArmourPiercer1/dsh-agent-team#0fa2cd76de2b48ef287ca3bf82ac6b03b30e3ab8'
const ROW = import.meta.dirname + '/abi-probe-row.mjs'
const LOG = join(import.meta.dirname, 'abi-probe-host.log')
const PORT = 3185

rmSync(HOME, { recursive: true, force: true })
mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
mkdirSync(join(HOME, 'workspace'), { recursive: true })
writeFileSync(join(HOME, 'profiles', 'web', 'pnpm-workspace.yaml'), `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: /srv/workspace/dsh-plugins/dsh-agent-team/.pnpm-store-a5ie-r2b\n`)
const add = spawnSync(process.execPath, [BIN, 'plugin', '--profile', 'web', 'add', SPEC], { cwd: join(HOME, 'workspace'), encoding: 'utf8', env: { ...process.env, DSH_HOME: HOME }, timeout: 600_000 })
console.log('plugin add exit', add.status)
writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), `- insert:\n  - id: a5ie-abi-probe\n    name: ${ROW}\n    config: {}\n`)

const { openSync } = await import('node:fs')
const fd = openSync(LOG, 'w')
const host = spawn(process.execPath, [BIN, 'web', '--port', String(PORT), '--no-open'], {
  cwd: join(HOME, 'workspace'), stdio: ['ignore', fd, fd],
  env: { ...process.env, DSH_HOME: HOME, DEEPSEEK_BASE_URL: 'http://127.0.0.1:1', DEEPSEEK_API_KEY: 'x' },
})
await new Promise((r) => setTimeout(r, 25_000))
host.kill()
await new Promise((r) => setTimeout(r, 2000))
const text = readFileSync(LOG, 'utf8')
console.log('---- probe lines ----')
console.log(text.split('\n').filter((l) => /a5ie-abi-probe/.test(l)).join('\n'))
console.log('---- boot line ----')
console.log(text.split('\n').filter((l) => /dsh web:|ERR|Error/.test(l)).slice(0, 6).join('\n'))
if (!existsSync(LOG)) console.log('no log')
host.kill()
