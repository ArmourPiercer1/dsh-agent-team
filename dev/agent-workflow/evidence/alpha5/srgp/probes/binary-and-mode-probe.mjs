/**
 * binary-and-mode-probe.mjs — three narrow questions the parity table needs:
 *  (1) what does `--json` actually emit for a file whose matching line carries a
 *      NUL (the binary class)? raw records, not a summary.
 *  (2) the `-l` / `-c` native oracles, read as PLAIN lines (the earlier probe
 *      projected them through the JSON reader and so saw nothing).
 *  (3) the duplicate-record question (P9 showed one path twice).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const W = join(REPO, 'tests/homes', `a5srgp-bin-${Date.now().toString(36)}`)
const ROOT = join(W, 'root')
const TOK = 'A5SRGP-TOK'
mkdirSync(join(ROOT, 'src'), { recursive: true })
const files = {
  'src/a.ts': `one ${TOK}\nplain\n`,
  'src/deep.ts': `${TOK} deep\n`,
  'src/BINARY.bin': `pre ${TOK} post\x00tail\n`,
  'src/MIDNUL.bin': `\x00${TOK} after-nul\n`,
  'crlf.txt': `first ${TOK}\r\n`,
}
let i = 0
for (const [rel, c] of Object.entries(files)) {
  const t = join(ROOT, rel)
  writeFileSync(t, c)
  utimesSync(t, 1_600_000_000 + i, 1_600_000_000 + i)
  i += 1
}
const nat = (argv) => {
  const r = spawnSync(RG, argv, { cwd: ROOT, encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
  return { code: r.status, stdout: r.stdout.toString('latin1'), stderr: r.stderr.toString('latin1') }
}
const base = ['--no-config', '--no-messages', '--no-ignore-parent', '--', '.']
console.log('--- raw JSON records (binary class) ---')
for (const line of nat(['--no-config', '--json', '--no-messages', '--no-ignore-parent', '--', '.']).stdout.split('\n')) {
  if (line.trim().length === 0) continue
  console.log(line.slice(0, 300))
}
console.log('--- -l oracle (plain) ---')
console.log(JSON.stringify(nat(['--no-config', '-l', ...base]).stdout.split('\n').filter((l) => l.length > 0)))
console.log('--- -c oracle (plain) ---')
console.log(JSON.stringify(nat(['--no-config', '-c', ...base]).stdout.split('\n').filter((l) => l.length > 0)))
console.log('--- -c with a 2-match file ---')
writeFileSync(join(ROOT, 'src', 'twice.ts'), `${TOK} a\n${TOK} b\n`)
console.log(JSON.stringify(nat(['--no-config', '-c', ...base]).stdout.split('\n').filter((l) => l.length > 0)))
console.log('--- json match count per path ---')
const counts = {}
for (const line of nat(['--no-config', '--json', '--no-messages', '--no-ignore-parent', '--', '.']).stdout.split('\n')) {
  if (!line.includes('"type":"match"')) continue
  const rec = JSON.parse(line)
  counts[rec.data.path.text] = (counts[rec.data.path.text] ?? 0) + 1
}
console.log(JSON.stringify(counts))
console.log('--- grep(1) port on the same tree ---')
const g = spawnSync('grep', ['-rIn', '--binary-files=without-match', '-E', '--', TOK, '.'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
console.log(g.stdout)
rmSync(W, { recursive: true, force: true })
