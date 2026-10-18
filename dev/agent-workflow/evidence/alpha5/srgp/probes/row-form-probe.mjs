/**
 * row-form-probe.mjs — the MEASURED row argv form, before the row exists.
 *
 * The stdin fact found by confined-stdin-probe (inside the confined child fd 0
 * is a SOCKET, so rg 15's heuristic "chose to search stdin" and the walk
 * silently searched NOTHING — exit 0, zero records, zero stderr) forces exactly
 * one thing of the row: argv must carry an EXPLICIT search path. The row spells
 * it as the constant `.` (the child's cwd is the anchored directory), so argv
 * still carries no attacker-controlled string.
 *
 * Everything below is then measured on the fixed fixture, native vs confined,
 * including what stderr means when the ignore law is ON (upward discovery hits
 * the confine and speaks), so the row's error discriminator is a measurement.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const W = join(REPO, 'tests/homes', `a5srgp-form-${Date.now().toString(36)}`)
const ROOT = join(W, 'root')
const OUTSIDE = join(W, 'outside')
const TOK = 'A5SRGP-TOK'

function build() {
  mkdirSync(join(ROOT, 'src'), { recursive: true })
  mkdirSync(join(ROOT, 'ignored'), { recursive: true })
  mkdirSync(join(ROOT, 'node_modules', 'pkg'), { recursive: true })
  mkdirSync(join(ROOT, 'dotdir'), { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
  writeFileSync(join(OUTSIDE, 'secret.txt'), `${TOK} OUTSIDE\n`)
  writeFileSync(join(ROOT, '.gitignore'), 'ignored/\nnode_modules/\n')
  const files = {
    'src/a.ts': `one ${TOK}\nplain\n`,
    'src/deep.ts': `${TOK} deep\n`,
    'src/BINARY.bin': `pre ${TOK} post\x00tail\n`,
    'ignored/drop.ts': `${TOK} IGNORED\n`,
    'node_modules/pkg/index.ts': `${TOK} DEPS\n`,
    '.hidden.ts': `${TOK} HIDDEN\n`,
    'dotdir/.secret.log': `${TOK} DOTDIR\n`,
    'unreadable.ts': `${TOK} UNREADABLE\n`,
  }
  let i = 0
  for (const [rel, c] of Object.entries(files)) {
    const t = join(ROOT, rel)
    mkdirSync(dirname(t), { recursive: true })
    writeFileSync(t, c)
    utimesSync(t, 1_600_000_000 + i, 1_600_000_000 + i)
    i += 1
  }
  chmodSync(join(ROOT, 'unreadable.ts'), 0o000)
  symlinkSync(join(OUTSIDE, 'secret.txt'), join(ROOT, 'escape-link.txt'))
}

const rows = []
const record = (tag, argv, run, extra = {}) => {
  const matches = run.stdout.split('\n').filter((l) => l.includes('"type":"match"')).map((l) => {
    const rec = JSON.parse(l)
    return { path: rec.data.path.text, line: rec.data.line_number, hasBytes: rec.data.lines.text === undefined }
  })
  const row = { tag, argv: argv.slice(1).map((a) => a.replace(RG, '<rg>')), code: run.code, outBytes: run.stdout.length, outHead: run.stdout.slice(0, 160), matches, stderr: run.stderr.slice(0, 2400), ...extra }
  rows.push(row)
  console.log(`${row.tag} | exit=${String(row.code)} outBytes=${String(row.outBytes)} out=${JSON.stringify(row.outHead)} matches=${JSON.stringify(row.matches).slice(0, 240)} | err=${JSON.stringify(row.stderr).slice(0, 700)}`)
}

build()
const FORM = ['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', '.']
const nat = (argv) => {
  const r = spawnSync(RG, argv, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}
console.log('--- native (unconfined oracle) ---')
record('F1-native-rowform', [RG, ...FORM], nat(FORM))
record('F2-native-invalid', [RG, '--no-config', '--json', '--regexp=(', '--', '.'], nat(['--no-config', '--json', '--regexp=(', '--', '.']))
record('F3-native-file-arg', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'src/a.ts'], nat(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'src/a.ts']))
record('F4-native-escape-arg', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'escape-link.txt'], nat(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'escape-link.txt']))
record('F5-native-nomessages', [RG, ...FORM.slice(0, 4), '--no-messages', ...FORM.slice(4)], nat(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--no-messages', '--', '.']))

const { createConfinedProcessProvider } = await import(join(REPO, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js'))
const p = createConfinedProcessProvider({ realmId: 'x', trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`, scratchRoot: join(W, 'scratch'), assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 } })
const probeRes = await p.probe()
console.log('--- confined (the row execution face) --- probe.ok =', probeRes.ok === true)
const rx = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const allow = [rx('/bin'), rx('/usr'), rx('/lib'), rx(RG.slice(0, RG.lastIndexOf('/'))), { path: ROOT, accessBits: { readFile: true, readDir: true } }]
const run = async (argv) => {
  const h = await p.spawnStreaming({ grantFingerprint: 'g', realmId: 'x', bindingId: 'b', memberScope: 'm', argv: [...argv], cwd: ROOT, env: [['PATH', '/usr/bin:/bin']], allowPaths: allow })
  if (h.ok !== true) return { code: null, stdout: '', stderr: `SPAWN-REFUSED ${String(h.error?.code)}` }
  const c = h.value
  c.stdin.end()
  let stdout = ''
  let stderr = ''
  c.stdout.on('data', (d) => { stdout += String(d) })
  c.stderr.on('data', (d) => { stderr += String(d) })
  const ex = await Promise.race([c.exited, sleep(25_000).then(() => ({ timedOut: true }))])
  await c.terminate()
  return { code: ex?.timedOut === true ? 'TIMEOUT' : ex?.code, stdout, stderr }
}
record('C0-confined-echo', ['/bin/echo', 'HELLO'], await run(['/bin/echo', 'HELLO']))
await sleep(80)
record('C0b-confined-rgversion', [RG, '--version'], await run([RG, '--version']))
await sleep(80)
record('C0c-confined-ls-rgdir', ['/bin/ls', '-l', RG.slice(0, RG.lastIndexOf('/'))], await run(['/bin/ls', '-l', RG.slice(0, RG.lastIndexOf('/'))]))
await sleep(80)
record('C0d-confined-sh-rg', ['/bin/sh', '-c', `echo start; ls -l ${RG}; ${RG} --version; echo rc=$?`], await run(['/bin/sh', '-c', `echo start; ls -l ${RG}; ${RG} --version; echo rc=$?`]))
await sleep(80)
record('C1-confined-rowform', [RG, ...FORM], await run(FORM))
await sleep(80)
record('CX-confined-debug', [RG, ...FORM.slice(0, 4), '--debug', ...FORM.slice(4)], await run(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--debug', '--', '.']))
await sleep(80)
record('C2-confined-invalid', [RG, '--no-config', '--json', '--regexp=(', '--no-ignore-parent', '--', '.'], await run(['--no-config', '--json', '--regexp=(', '--no-ignore-parent', '--', '.']))
await sleep(80)
record('C3-confined-file-arg', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'src/a.ts'], await run(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'src/a.ts']))
await sleep(80)
record('C4-confined-escape-arg', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'escape-link.txt'], await run(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', 'escape-link.txt']))
await sleep(80)
record('C5-confined-nomessages', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--no-messages', '--', '.'], await run(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--no-messages', '--', '.']))
await sleep(80)
record('C6-confined-abs-dot-arg', [RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', ROOT], await run(['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--', ROOT]))

chmodSync(join(ROOT, 'unreadable.ts'), 0o644)
try { rmSync(W, { recursive: true, force: true }) } catch { /* scratch */ }
writeFileSync(join(HERE, 'row-form-measurements.json'), `${JSON.stringify(rows, null, 2)}\n`)
