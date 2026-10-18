/**
 * coverage-probe.mjs — the measurement behind this round's two changes:
 *
 *  (1) WHY `--no-messages` is absent from the fixed argv. It was there to keep the
 *      upward-discovery noise (`/…/.git: Permission denied (os error 13)`) off a
 *      channel; measured here, it ALSO silences the only evidence that the KERNEL
 *      refused the walk end to end — turning "nothing was read" into a silent
 *      "no matches" (leg G below, versus leg B).
 *  (2) WHAT distinguishes the two shapes worth distinguishing: the refusal names a
 *      path RELATIVE to the search element (`.:`, `./src/a.ts`), the noise names an
 *      ABSOLUTE path above the governed root. That is the whole discriminator the
 *      row's coverage law uses — the CLASS of the line, never its text.
 *
 * Run: node dev/agent-workflow/evidence/alpha5/srgp/probes/coverage-probe.mjs
 * Writes coverage-measurements.json next to itself. Worlds under
 * tests/homes/a5srgp-cov-*, destroyed at the end.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..', '..', '..')
const RG = join(REPO, 'node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg')
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const W = join(REPO, 'tests/homes', `a5srgp-cov-${Date.now().toString(36)}`)
const TOK = 'A5SRGP-TOK'

const { createConfinedProcessProvider } = await import(
  pathToFileURL(join(REPO, 'packages/runtime/dist/packages/runtime/sandbox-provider/index.js')).href
)

const ROOT = join(W, 'root')
const EMPTY = join(W, 'empty')
const IGNORED = join(W, 'ignored')
mkdirSync(join(ROOT, 'src'), { recursive: true })
writeFileSync(join(ROOT, 'src/a.ts'), `${TOK} one\n`)
mkdirSync(EMPTY, { recursive: true })
mkdirSync(IGNORED, { recursive: true })
writeFileSync(join(IGNORED, '.gitignore'), '*.ts\n')
writeFileSync(join(IGNORED, 'only.ts'), `${TOK} hidden-by-law\n`)

const provider = createConfinedProcessProvider({
  realmId: 'a5srgp-cov',
  trustRoot: `sha256:${SHA.slice(0, 16)}#${LAUNCHER}`,
  scratchRoot: join(W, 'scratch'),
  assembly: { launcherPath: LAUNCHER, launcherSha256: SHA, minAbiVersion: 3 },
})
await provider.probe()

const rx = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const SYS = [rx('/bin'), rx('/usr'), rx('/lib'), rx(RG.slice(0, RG.lastIndexOf('/')))]
const rows = []

async function leg(tag, cwd, { messages = false, grant = null, pathElt = '.', argvTail = [] } = {}) {
  const argv = [
    RG, '--no-config', '--json', `--regexp=${TOK}`,
    '--no-ignore-parent', '--no-ignore-global',
    ...(messages ? ['--no-messages'] : []),
    ...argvTail,
    '--', pathElt,
  ]
  const allowPaths = [...SYS, ...(grant === null ? [] : [grant])]
  const h = await provider.spawnStreaming({
    grantFingerprint: `cov:${tag}`, realmId: 'a5srgp-cov', bindingId: 'cov', memberScope: 'leg',
    argv, cwd, env: [['PATH', '/usr/bin:/bin']], allowPaths,
  })
  if (h.ok !== true) {
    rows.push({ leg: tag, spawn: `REFUSED ${String(h.error?.code)}` })
    console.log(`${tag} | spawn REFUSED ${String(h.error?.code)}`)
    return
  }
  const child = h.value
  try { child.stdin.end() } catch { /* closed */ }
  let out = ''
  let err = ''
  child.stdout.on('data', (d) => { out += String(d) })
  child.stderr.on('data', (d) => { err += String(d) })
  const settled = await Promise.race([child.exited, new Promise((r) => setTimeout(() => r({ code: -9, signal: 'probe-timeout' }), 30_000))])
  await child.terminate()
  const relative = err.split('\n').filter((l) => /^rg: (.*): (Permission denied|Operation not permitted)/.test(l) && !(l.match(/^rg: (.*):/)?.[1] ?? '').startsWith('/'))
  const absolute = err.split('\n').filter((l) => /^rg: (.*): (Permission denied|Operation not permitted)/.test(l) && (l.match(/^rg: (.*):/)?.[1] ?? '').startsWith('/'))
  const row = {
    leg: tag,
    reported: settled,
    summary: out.includes('"type":"summary"'),
    matchRecord: out.includes('"type":"match"'),
    searches: Number(/"searches":\s*(\d+)/.exec(out)?.[1] ?? -1),
    bytesSearched: Number(/"bytes_searched":\s*(\d+)/.exec(out)?.[1] ?? -1),
    stderrBytes: err.length,
    relativeRefusals: relative,
    absoluteNoise: absolute.length,
    coverageLawSays: relative.length > 0 ? 'walker-permission-refused' : 'no-refusal',
  }
  rows.push(row)
  console.log(`${tag} | reported=${JSON.stringify(settled)} summary=${String(row.summary)} match=${String(row.matchRecord)} searches=${String(row.searches)} bytes=${String(row.bytesSearched)} stderr=${String(err.length)}B relative=${JSON.stringify(relative)} noiseLines=${String(absolute.length)} => ${row.coverageLawSays}`)
}

const rootGrant = { path: ROOT, accessBits: { readFile: true, readDir: true } }
await leg('A-off-normal', ROOT, { grant: rootGrant })
await leg('B-off-nogrants', ROOT, {})
await leg('C-off-emptyroot', EMPTY, { grant: { path: EMPTY, accessBits: { readFile: true, readDir: true } } })
await leg('D-off-allignored', IGNORED, { grant: { path: IGNORED, accessBits: { readFile: true, readDir: true } } })
await leg('E-off-readdir-only', ROOT, { grant: { path: ROOT, accessBits: { readDir: true } } })
await leg('F-on-normal', ROOT, { messages: true, grant: rootGrant })
await leg('G-on-nogrants', ROOT, { messages: true })
// H: the shape the ROW can actually be handed — a file inside the walked tree the
// walker cannot open (same uid, so a directory refusal would already have failed
// the anchor open). Partial coverage, and the walker still completes.
const blocked = join(ROOT, 'src', 'blocked.ts')
writeFileSync(blocked, `${TOK} blocked\n`)
const { chmodSync } = await import('node:fs')
chmodSync(blocked, 0o000)
await leg('H-off-partial-refusal', ROOT, { grant: rootGrant })
chmodSync(blocked, 0o644)
rmSync(blocked, { force: true })

// J: the NATIVE witness for the same partial-refusal shape. `rg` exits 2 when any
// searched path is unreadable, which the host's own law maps to a search failure
// (`exit \u2209 {0,1}` \u2192 SEARCH_FAILED). The row refuses the same class through the
// channels this face carries \u2014 it is re-pressing the host's law, not inventing one.
chmodSync(join(ROOT, 'src', 'a.ts'), 0o000)
const nativePartial = spawnSync(RG, ['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--no-ignore-global', '--', '.'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
rows.push({ leg: 'J-native-partial-refusal', exit: nativePartial.status, stderr: nativePartial.stderr.trim().slice(0, 160) })
console.log(`J-native-partial-refusal | exit=${String(nativePartial.status)} err=${JSON.stringify(nativePartial.stderr.trim().slice(0, 160))}`)
chmodSync(join(ROOT, 'src', 'a.ts'), 0o644)

// The native reference for the same walk, to show the row is RE-PRESSING the
// host's exit-code law (rg exits 2 on any unreadable path) through the only
// channels this face carries.
const native = spawnSync(RG, ['--no-config', '--json', `--regexp=${TOK}`, '--no-ignore-parent', '--no-ignore-global', '--', '.'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
rows.push({ leg: 'I-native-normal', exit: native.status, stderr: native.stderr.trim().slice(0, 120) })
console.log(`I-native-normal | exit=${String(native.status)} err=${JSON.stringify(native.stderr.trim().slice(0, 120))}`)

writeFileSync(join(HERE, 'coverage-measurements.json'), `${JSON.stringify({
  rg: RG,
  launcher: { path: LAUNCHER, sha256: SHA },
  rows,
}, null, 2)}\n`)
rmSync(W, { recursive: true, force: true })
console.log('wrote coverage-measurements.json')
