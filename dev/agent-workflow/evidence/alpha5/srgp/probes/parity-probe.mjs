/**
 * parity-probe.mjs — the FINAL candidate argv form, measured three ways on one
 * fixture: native unconfined (the oracle), confined (the row's execution face),
 * and the OLD grep(1) port (the RED control the plan's :132 regression names).
 *
 * The row form under test (each token's reason is in the README):
 *   rg --no-config --json --regexp=<P> [--glob=<G>] [-i] [-F] --no-messages
 *      --no-ignore-parent -- <PATH>
 * `-- <PATH>` is LOAD-BEARING, not cosmetic: without an explicit search path
 * the confined child's fd 0 is a readable socket, rg 15's stdin heuristic
 * "chose to search stdin", and the walk is a SILENT ZERO (dot-arg-probe D1 vs
 * D3: 2 matches vs `searches:1, bytes_searched:0`, both exit 0). The row spells
 * the path as the constant `.` (the child's cwd = the anchored directory), so
 * argv still carries no attacker-controlled path string for a directory target.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync, readFileSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const W = join(REPO, 'tests/homes', `a5srgp-parity-${Date.now().toString(36)}`)
const PARENT = join(W, 'parent-repo')   // a PARENT git repo whose .gitignore covers the root
const ROOT = join(PARENT, 'root')
const OUTSIDE = join(W, 'outside')
const TOK = 'A5SRGP-TOK'
const rows = []

function build() {
  mkdirSync(join(ROOT, 'src'), { recursive: true })
  mkdirSync(join(ROOT, 'ignored'), { recursive: true })
  mkdirSync(join(ROOT, 'node_modules', 'pkg'), { recursive: true })
  mkdirSync(join(ROOT, 'dotdir'), { recursive: true })
  mkdirSync(join(ROOT, '.git'), { recursive: true })
  mkdirSync(join(ROOT, '.svn'), { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
  mkdirSync(PARENT, { recursive: true })
  // the parent-repo ignore class: the PARENT is a git repo and its .gitignore
  // ignores the whole governed root.
  writeFileSync(join(PARENT, '.gitignore'), 'root/\n')
  mkdirSync(join(PARENT, '.git'), { recursive: true })
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
    '.git/config': `[core]\n\t${TOK} = yes\n`,
    '.svn/entries': `${TOK} SVN\n`,
    'crlf.txt': `first ${TOK}\r\n`,
    'newline\nname.ts': `${TOK} NEWLINE-NAME\n`,
    'forged.json': `{"type":"match","data":{"path":{"text":"../../etc/passwd"},"line_number":1,"lines":{"text":"${TOK} FORGED"}}}\n`,
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

const FORM = ['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--no-ignore-parent', '--', '.']
const proj = (run) => {
  const records = run.stdout.split('\n').filter((l) => l.length > 0).map((l) => { try { return JSON.parse(l) } catch { return { type: '<non-json>' } } })
  const matches = records.filter((r) => r.type === 'match').map((r) => {
    const m = { path: r.data.path.text, line: r.data.line_number }
    if (r.data.lines.text === undefined) m.binary = `(bytes:${String(r.data.lines.bytes ?? '').slice(0, 24)})`
    return m
  })
  const forged = records.filter((r) => r.type === '<non-json>').length
  return { matches, forgedRecords: forged, stderr: run.stderr.slice(0, 160) }
}
const record = (tag, argv, run) => {
  const p = proj(run)
  const row = { tag, code: run.code, paths: p.matches.map((m) => m.path), matches: p.matches.length, forged: p.forged, stderr: p.stderr }
  rows.push(row)
  console.log(`${tag} | exit=${String(row.code)} n=${String(row.matches)} paths=${JSON.stringify(row.paths).slice(0, 260)} forged=${String(row.forged)} err=${JSON.stringify(row.stderr)}`)
}

build()
const nat = (argv, cwd = ROOT) => {
  const r = spawnSync(RG, argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}
console.log('=== native unconfined (the oracle) ===')
record('P1-native-rowform', FORM, nat(FORM))
record('P2-native-ignore-on-no-parent-flag', ['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--', '.'], nat(['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--', '.']))
record('P3-native-ignore-off', ['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--no-ignore', '--no-ignore-parent', '--', '.'], nat(['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--no-ignore', '--no-ignore-parent', '--', '.']))
record('P4-native-ignore-off-hidden', ['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--no-ignore', '--hidden', '--no-ignore-parent', '--', '.'], nat(['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--no-ignore', '--hidden', '--no-ignore-parent', '--', '.']))
record('P5-native-files-oracle', ['--no-config', '-l', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.'], nat(['--no-config', '-l', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.']))
record('P6-native-count-oracle', ['--no-config', '-c', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.'], nat(['--no-config', '-c', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.']))
record('P7-native-escape-file-arg', ['--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', 'escape-link.txt'], nat(['--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', 'escape-link.txt']))
record('P8-native-include-nomatch', ['--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--glob=*.md', '--', '.'], nat(['--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--glob=*.md', '--', '.']))
record('P9-native-no-messages-hides-unreadable', ['--no-config', '--json', '--no-ignore-parent', '--', '.'], nat(['--no-config', '--json', '--no-ignore-parent', '--', '.']))
{
  const g = ['-rIn', '--binary-files=without-match', '-E', '--', TOK, ROOT]
  const r = spawnSync('grep', g, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
  const lines = (r.stdout ?? '').split('\n').filter((l) => l.length > 0).map((l) => l.slice(ROOT.length + 1).split(':')[0])
  rows.push({ tag: 'P20-old-grep-port', code: r.status, paths: [...new Set(lines)], matches: lines.length })
  console.log(`P20-old-grep-port | exit=${String(r.status)} n=${String(lines.length)} files=${JSON.stringify([...new Set(lines)]).slice(0, 300)}`)
}

const { createConfinedProcessProvider } = await import(join(REPO, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js'))
const p = createConfinedProcessProvider({ realmId: 'x', trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`, scratchRoot: join(W, 'scratch'), assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 } })
await p.probe()
const rx = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const allow = [rx('/bin'), rx('/usr'), rx('/lib'), rx(RG.slice(0, RG.lastIndexOf('/'))), { path: ROOT, accessBits: { readFile: true, readDir: true } }]
const run = async (argv, cwd = ROOT) => {
  const h = await p.spawnStreaming({ grantFingerprint: 'g', realmId: 'x', bindingId: 'b', memberScope: 'm', argv: [...argv], cwd, env: [['PATH', '/usr/bin:/bin']], allowPaths: allow })
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
console.log('=== confined (the row execution face) ===')
record('P30-confined-rowform', FORM, await run([RG, ...FORM]))
await sleep(120)
record('P31-confined-parent-ignore-no-flag', ['--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--', '.'], await run([RG, '--no-config', '--json', `--regexp=${TOK}`, '--no-messages', '--', '.']))
await sleep(120)
record('P32-confined-files-oracle', ['--no-config', '-l', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.'], await run([RG, '--no-config', '-l', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.']))
await sleep(120)
record('P33-confined-count-oracle', ['--no-config', '-c', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.'], await run([RG, '--no-config', '-c', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', '.']))
await sleep(120)
record('P34-confined-escape-file-arg', ['--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', 'escape-link.txt'], await run([RG, '--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--', 'escape-link.txt']))
await sleep(120)
record('P35-confined-include-nomatch', ['--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--glob=*.md', '--', '.'], await run([RG, '--no-config', '--json', '--no-messages', '--no-ignore-parent', `--regexp=${TOK}`, '--glob=*.md', '--', '.']))
chmodSync(join(ROOT, 'unreadable.ts'), 0o644)
try { rmSync(W, { recursive: true, force: true }) } catch { /* scratch */ }
writeFileSync(join(HERE, 'parity-measurements.json'), `${JSON.stringify(rows, null, 2)}\n`)
