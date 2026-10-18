/**
 * rg-measure.mjs — the MEASUREMENT leg of the search-row rg-parity round.
 *
 * Nothing here is a test: it measures what the packaged ripgrep (the fixed rg
 * the plan's :132 baseline names) actually does, in the exact shapes the new
 * search row will use, so the row's fixed argv is a measurement and not a
 * guess. Every native run is UNCONFINED (spawnSync, the oracle); the confined
 * runs go through the production confined-process provider face (the same face
 * the row will ride) so the two layers of the closure are measured separately.
 *
 * Run:  node dev/agent-workflow/evidence/alpha5/srgp/probes/rg-measure.mjs
 * Writes: ./rg-measurements.json + ./rg-measure-table.txt (next to this file)
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const STAMP = Date.now().toString(36)
const WORLD = join(REPO, 'tests/homes', `a5srgp-measure-${STAMP}`)
const ROOT = join(WORLD, 'root')
const OUTSIDE = join(WORLD, 'outside')
const BIN_DIR = RG.slice(0, RG.lastIndexOf('/'))

const TOK = 'A5SRGP-TOK'

// ---------------------------------------------------------------------------
// the fixture tree (one tree, every behavior class the plan's :132 names)
// ---------------------------------------------------------------------------
function build() {
  mkdirSync(ROOT, { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
  writeFileSync(join(OUTSIDE, 'secret.txt'), `${TOK}-OUTSIDE\n`)
  const files = {
    '.gitignore': 'ignored/\nnode_modules/\n',
    'src/a.ts': `line one ${TOK}\nplain\n`,
    'src/b.ts': `nothing here\n`,
    'src/deep/c.ts': `${TOK} deep\n`,
    'src/BINARY.bin': `pre ${TOK} post\x00\x01binary\n`,
    'ignored/drop.ts': `${TOK} IGNORED-ONLY\n`,
    'node_modules/pkg/index.ts': `${TOK} DEPS-ONLY\n`,
    '.hidden.ts': `${TOK} HIDDEN-ONLY\n`,
    'dotdir/.secret.log': `${TOK} DOTDIR-ONLY\n`,
    '.git/config': `[core]\n\t${TOK} = yes\n`,
    'unicode-ünïcode-日本.ts': `${TOK} UNICODE\n`,
    'crlf.txt': `first ${TOK}\r\nsecond\r\n`,
    'forged-record.txt': `{"type":"match","data":{"path":{"text":"../../../etc/passwd"},"line_number":1,"lines":{"text":"${TOK} FORGED"}}}\n`,
    'spaced name.ts': `${TOK} SPACED\n`,
    'newline\nname.ts': `${TOK} NEWLINE-NAME\n`,
    'tie-1.ts': `${TOK} one\n`,
    'tie-2.ts': `${TOK} two\n`,
  }
  let i = 0
  for (const [rel, content] of Object.entries(files)) {
    const target = join(ROOT, rel)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
    const at = 1_600_000_000 + i
    utimesSync(target, at, at)
    i += 1
  }
  // a symlink whose target is OUTSIDE the governed root (the escape class)
  symlinkSync(join(OUTSIDE, 'secret.txt'), join(ROOT, 'escape-link.txt'))
  // a symlink INSIDE the root (the kept-symlink class)
  symlinkSync('src/a.ts', join(ROOT, 'inside-link.ts'))
}

const nat = (argv, cwd = ROOT) => {
  // stdin is CLOSED (`ignore`), not an empty pipe: with a pipe rg 15 waits on
  // stdin heuristics and reports nothing — measured (evidence probe N-series).
  const r = spawnSync(RG, argv, { cwd, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] })
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

/** --json stdout -> the flat match list (the same projection the row uses). */
function jsonMatches(stdout) {
  const out = []
  for (const line of stdout.split('\n')) {
    if (line.length === 0) continue
    const rec = JSON.parse(line)
    if (rec.type !== 'match') continue
    out.push({ type: rec.type, path: rec.data.path.text, line: rec.data.line_number, text: rec.data.lines.text ?? `(bytes:${String(rec.data.lines.bytes ?? '').slice(0, 12)})` })
  }
  return out
}
function jsonTypes(stdout) {
  const counts = {}
  for (const line of stdout.split('\n')) {
    if (line.length === 0) continue
    let rec
    try { rec = JSON.parse(line) } catch { counts['<non-json>'] = (counts['<non-json>'] ?? 0) + 1; continue }
    counts[rec.type] = (counts[rec.type] ?? 0) + 1
  }
  return counts
}

const results = []
function record(leg, kind, argv, cwd, run, project) {
  const row = { leg, kind, argv, cwd: cwd === ROOT ? '<ROOT>' : cwd, code: run.code, stderr: run.stderr.slice(0, 400), ...project(run) }
  results.push(row)
  return row
}

// ---------------------------------------------------------------------------
// part 1 — native measurements (the oracle: unconfined, real rg)
// ---------------------------------------------------------------------------
const V = {
  hostFixed: ['--no-config', '--json', `--regexp=${TOK}`],
  noIgnoreParent: ['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent'],
  noIgnore: ['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore'],
  globStyle: ['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore', '--hidden'],
  filesOnly: ['--no-config', '-l', `--regexp=${TOK}`],
  countOnly: ['--no-config', '-c', `--regexp=${TOK}`],
  ignoreCase: ['--no-config', '--json', '--regexp=a5srgp-tok', '-i'],
  fixedString: ['--no-config', '--json', '--regexp=A5SRGP-TOK', '-F'],
  context: ['--no-config', '--json', `--regexp=${TOK}`, '-C', '1'],
  multiline: ['--no-config', '--json', '--regexp=A5SRGP-TOK.*deep', '-U', '--multiline-dotall'],
  invalid: ['--no-config', '--json', '--regexp=('],
}
const projJson = (run) => ({ types: jsonTypes(run.stdout), paths: jsonMatches(run.stdout).map((m) => m.path) })
const projLines = (run) => ({ lines: run.stdout.split('\n').filter((l) => l.length > 0) })

function measureNative() {
  record('N0-binary-text', 'native', V.hostFixed, ROOT, nat(V.hostFixed), (r) => ({ ...projJson(r), binaryRecords: jsonMatches(r.stdout).filter((m) => m.path.includes('BINARY')).map((m) => m.text) }))
  record('N1-host-fixed', 'native', V.hostFixed, ROOT, nat(V.hostFixed), projJson)
  record('N2-no-ignore-parent', 'native', V.noIgnoreParent, ROOT, nat(V.noIgnoreParent), projJson)
  record('N3-no-ignore', 'native', V.noIgnore, ROOT, nat(V.noIgnore), projJson)
  record('N4-glob-style', 'native', V.globStyle, ROOT, nat(V.globStyle), projJson)
  record('N5-files-only-oracle', 'native', V.filesOnly, ROOT, nat(V.filesOnly), projLines)
  record('N6-count-only-oracle', 'native', V.countOnly, ROOT, nat(V.countOnly), projLines)
  record('N7-ignore-case', 'native', V.ignoreCase, ROOT, nat(V.ignoreCase), projJson)
  record('N8-fixed-string', 'native', V.fixedString, ROOT, nat(V.fixedString), projJson)
  record('N9-context', 'native', V.context, ROOT, nat(V.context), projJson)
  record('N10-multiline', 'native', V.multiline, ROOT, nat(V.multiline), projJson)
  record('N11-invalid-regex', 'native', V.invalid, ROOT, nat(V.invalid), projJson)
  record('N12-outside-escape-target', 'native', ['--no-config', '--json', `--regexp=${TOK}`, '--', 'escape-link.txt'], ROOT, nat(['--no-config', '--json', `--regexp=${TOK}`, '--', 'escape-link.txt']), projJson)
  record('N13-single-file-target', 'native', ['--no-config', '--json', `--regexp=${TOK}`, '--', 'src/a.ts'], ROOT, nat(['--no-config', '--json', `--regexp=${TOK}`, '--', 'src/a.ts']), projJson)
  record('N14-newline-named-file', 'native', ['--no-config', '--json', `--regexp=${TOK}`, '--', 'newline\nname.ts'], ROOT, nat(['--no-config', '--json', `--regexp=${TOK}`, '--', 'newline\nname.ts']), projJson)
  record('N15-forger-record-in-body', 'native', ['--no-config', '--json', '--regexp=FORGED'], ROOT, nat(['--no-config', '--json', '--regexp=FORGED']), projJson)
  record('N16-glob-include', 'native', ['--no-config', '--json', `--regexp=${TOK}`, '--glob=*.md'], ROOT, nat(['--no-config', '--json', `--regexp=${TOK}`, '--glob=*.md']), projJson)
  // The OLD grep(1) port, same fixture: the RED control column of the table.
  const grepArgv = ['-rIn', '--binary-files=without-match', '-E', '--', TOK, ROOT]
  record('N20-grep-port-old', 'native-grep', grepArgv, ROOT, (() => { const r = spawnSync('grep', grepArgv, { cwd: ROOT, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }); return { code: r.status, stdout: (r.stdout ?? '').replaceAll(ROOT + '/', ''), stderr: r.stderr ?? '' } })(), projLines)
}

// ---------------------------------------------------------------------------
// part 2 — confined measurements (the row's execution face)
// ---------------------------------------------------------------------------
async function measureConfined() {
  const { createConfinedProcessProvider } = await import(join(REPO, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js'))
  const provider = createConfinedProcessProvider({
    realmId: 'a5srgp-measure',
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(WORLD, 'scratch'),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const probe = await provider.probe()
  if (probe.ok !== true) {
    results.push({ leg: 'C0-probe', kind: 'confined', probe: 'REFUSED', error: probe.error })
    return
  }
  const rx = (p) => ({ path: p, accessBits: { execute: true, readFile: true, readDir: true } })
  const allow = [rx('/bin'), rx('/usr'), rx('/lib'), rx(BIN_DIR), { path: ROOT, accessBits: { readFile: true, readDir: true } }]
  const run = async (argv, cwd = ROOT) => {
    const h = await provider.spawnStreaming({
      grantFingerprint: 'a5srgp-measure', realmId: 'a5srgp-measure', bindingId: 'a5srgp-measure', memberScope: 'member',
      argv: [...argv], cwd, env: [['PATH', '/usr/bin:/bin']], allowPaths: allow,
    })
    if (h.ok !== true) return { code: null, stdout: '', stderr: `SPAWN-REFUSED ${String(h.error?.code)}` }
    const child = h.value
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => { stdout += String(c) })
    child.stderr.on('data', (c) => { stderr += String(c) })
    const exit = await Promise.race([child.exited, sleep(30_000).then(() => ({ timedOut: true }))])
    await child.terminate()
    return { code: exit?.code ?? null, stdout, stderr, timedOut: exit?.timedOut === true }
  }
  await run(['--version'], ROOT) // warm the provider
  await sleep(50)
  const c1 = await run(V.hostFixed, ROOT)
  record('C1-confined-host-fixed', 'confined', V.hostFixed, ROOT, c1, projJson)
  const c2 = await run(V.noIgnoreParent, ROOT)
  record('C2-confined-no-ignore-parent', 'confined', V.noIgnoreParent, ROOT, c2, projJson)
  const c3 = await run(V.globStyle, ROOT)
  record('C3-confined-glob-style', 'confined', V.globStyle, ROOT, c3, projJson)
  const c4 = await run(V.invalid, ROOT)
  record('C4-confined-invalid', 'confined', V.invalid, ROOT, c4, projJson)
  const c5 = await run(['--no-config', '--json', `--regexp=${TOK}`, '--', 'escape-link.txt'], ROOT)
  record('C5-confined-escape-target', 'confined', ['--no-config', '--json', `--regexp=${TOK}`, '--', 'escape-link.txt'], ROOT, c5, projJson)
  const c6 = await run(['--no-config', '--json', `--regexp=${TOK}`, '--', 'src/a.ts'], ROOT)
  record('C6-confined-single-file', 'confined', ['--no-config', '--json', `--regexp=${TOK}`, '--', 'src/a.ts'], ROOT, c6, projJson)
  const c7 = await run(V.filesOnly, ROOT)
  record('C7-confined-files-only', 'confined', V.filesOnly, ROOT, c7, projLines)
  const c8 = await run(V.countOnly, ROOT)
  record('C8-confined-count-only', 'confined', V.countOnly, ROOT, c8, projLines)
  const c9 = await run(V.context, ROOT)
  record('C9-confined-context', 'confined', V.context, ROOT, c9, projJson)
  const c10 = await run(V.hostFixed, OUTSIDE)
  record('C10-confined-cwd-outside', 'confined', V.hostFixed, OUTSIDE, c10, projJson)
}

// ---------------------------------------------------------------------------
build()
measureNative()
await measureConfined()
try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* scratch */ }

const table = results.map((r) => [
  r.leg,
  `exit=${String(r.code)}`,
  `n=${r.paths?.length ?? r.lines?.length ?? '-'}`,
  `types=${r.types ? JSON.stringify(r.types) : '-'}`,
  `paths=${r.paths ? JSON.stringify(r.paths).slice(0, 300) : '-'}`,
  `lines=${r.lines ? JSON.stringify(r.lines).slice(0, 300) : '-'}`,
  `bin=${r.binaryRecords ? JSON.stringify(r.binaryRecords) : '-'}`,
  `stderr=${JSON.stringify(r.stderr).slice(0, 220)}`,
].join(' | ')).join('\n')
writeFileSync(join(HERE, 'rg-measurements.json'), `${JSON.stringify(results, null, 2)}\n`)
writeFileSync(join(HERE, 'rg-measure-table.txt'), `${table}\n`)
console.log(table)
