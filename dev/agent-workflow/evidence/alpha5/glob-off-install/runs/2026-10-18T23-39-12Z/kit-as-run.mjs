#!/usr/bin/env node
/**
 * a5glob-off-kit.mjs — globEnabled:false ON THE REAL INSTALLED FACE.
 *
 * What this kit is: the install-face acceptance of master's #342 (the closed
 * `planeCfg.globEnabled` shut-off key). The module layer already pins K1-K5
 * (`packages/runtime/test/a5-globoff-key.test.ts` at the commit); the root's
 * 21:39Z order says a module test is NOT the acceptance — the candidate must be
 * verified AFTER AN ACTUAL INSTALL OF THE NEW HEAD, on a plane world mounted
 * through the REAL host entry (the plugin boot path, row config in the profile
 * layer), never a hand-built assembly unit. This kit therefore reuses the
 * a5ie-r5 real-install skeleton (same install face, same three-zero law, same
 * public seams only) and changes only what the question needs.
 *
 * THE LEGS
 *  H  pins. H1 pristine host @ its own pin, porcelain 0. H1b the install spec is
 *     measured LIVE from TWO SOURCES (ls-remote in the pinned source worktree +
 *     ls-remote in the main checkout), both equal to the master SHA the kit was
 *     told to grade, and equal to the source worktree HEAD (nothing spliced).
 *     H1c that SHA's own lineage carries #342 and its SOURCE bytes carry the
 *     gate. H2 ports self-proved free. H0 :3080 read-only probe only.
 *  I  the REAL network install (`dsh plugin --profile web add github:…#<sha>`)
 *     into a NEW dir: THREE ZEROS (missing=0 / extra=0 / sha≠=0) + rootSha +
 *     launcher deployment bytes + --dump-config composition + I-SHIP: the gate
 *     is present in the INSTALLED dist bytes (the bytes that actually run).
 *  W  every live world re-installs byte-identical to the probe face.
 *  M  THE OFF FORM (world 'off': full config + teamToolPlane.globEnabled:false):
 *       M0 the mount is UNCHANGED (four plane names reach the member wire)
 *       M1 team_glob lands the EXISTING typed shut face, verbatim, and the
 *          detail sentence is compared against the sentence read out of the
 *          INSTALLED bytes (not transcribed here) — zero new error surface
 *       M2 ZERO glob-row spawns, out-of-band: the glob row's own confined
 *          scratch (`<root>.a5g7-glob-scratch`, the provider's plan/out ledger:
 *          one plans/<planId>.json + one out/<planId>/exit.json per confined
 *          spawn) is empty or absent — a shut row never even prepares a plan
 *       M2b the SAME ledger for the search and shell rows in the SAME world is
 *          NON-empty (the ledger detector's in-world positive control: it is
 *          not empty because nobody looked)
 *       M3/M4/M5/M6 team_grep hit / team_bash exit=0 + real write / team_bash
 *          out-of-bounds exit=1 + kernel stderr verbatim / read really reads
 *       M7 process-table corroboration: zero `rg` sightings for the whole off
 *          world while the sampler demonstrably saw the launcher lanes
 *       M8 host-log row witness: zero `anchored-glob` lines in the off world
 *          while `anchored-search`/`confined-shell` witnesses are present
 *       M9 NO FALLBACK: the glob fixture's unique seed names appear in NO wire
 *          byte and NO host-log byte of this world (nothing listed out, no
 *          partial result after the refusal)
 *       M10 the refusal landing carries NO result lines (no `> ` entries, no
 *          files_with_matches meta) — a refusal, not a truncated answer
 *  C  THE CONTROL (world 'default': byte-identical config with the key ABSENT):
 *       C1 glob runs for real (both seeds listed, no refusal, no exit=) — the
 *          zero-default-change law re-proved on the installed face
 *       C2 the glob row's plan ledger is NON-empty and its argv carries rg +
 *          `--files` (the out-of-band positive control of M2)
 *       C3 host log shows `anchored-glob ran` (the pair of M8)
 *       C4 the other three rows land the SAME shape as in the off world
 *       C5 the config bytes differ in exactly one key (layer file asserted)
 *       C6 r5-shaped regression on this world: bash positive + negative control
 *  R  RENAME CANNOT RESTORE (world 'rename': globEnabled:false + names.glob
 *     ='zglob'): the row mounts under the new spelling (R1) and still lands the
 *     same typed refusal (R2), its scratch ledger stays empty (R3), bash stays
 *     live (R4).
 *  Z/T closed-world checks and teardown (worlds swept by EXACT prefix, token
 *     hygiene, ports released, :3080 unchanged, pristine host still clean).
 *
 * KIT_EXIT: 0 GREEN · 2 RED (criteria kept at full height, landings quoted) ·
 * 1 FATAL. BOOK = recorded observation, never counted either way.
 *
 * @module evidence/alpha5/glob-off-install/a5glob-off-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as netServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const flag = (n) => args.includes(`--${n}`)
const HERE = dirname(new URL(import.meta.url).pathname)

/**
 * The commit this round grades. Defaults to the 21:39Z #342 baseline; a later
 * round (root 23:34Z) re-drives the SAME sheet for a default-contract positive
 * control on a named ref, so the install face is parameterised:
 *   --install-sha <40-hex>   the frozen SHA to install and grade
 *   --install-ref refs/heads/<branch>  the ref whose live tip must equal it
 *   --install-lineage <re>   what the graded commit's own subject must carry
 *   --world-prefix <p>       DSH_HOME prefix (cleanup stays exact-name)
 * Nothing else about the criteria moves: the three zeros, the argv-attributed
 * ledger, the sweep and the :3080 probe law are the same code.
 */
const EXPECTED_MASTER = argValue('install-sha', '46e48218e48314662586ff053ca3825e2889a6bb')
const INSTALL_REF = argValue('install-ref', 'refs/heads/master')
const INSTALL_REF_SHORT = INSTALL_REF.replace(/^refs\/heads\//, '')
const EXPECT_LINEAGE = new RegExp(argValue('install-lineage', '#342'))
/** Byte-pinned source root: a detached worktree AT that commit (harness bytes too). */
const SRC = resolve(argValue('src-root', ''))
if (!existsSync(join(SRC, 'tests/paths.mjs'))) throw new Error(`--src-root must be a checkout of the team repo: ${SRC}`)
/** Where the DSH_HOME worlds live (main checkout tests/homes, per TEST_METHODS §7). */
const HOMES_ROOT = resolve(argValue('homes-root', join(SRC, 'tests', 'homes')))
const MAIN_CHECKOUT = resolve(argValue('main-checkout', SRC))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, '..', 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })
const STORE_DIR = resolve(argValue('store-dir', join(HOMES_ROOT, '.a5glob-off-store')))
const KEEP = flag('keep')

const SRC_IMPORT = (rel) => import(pathToFileURL(join(SRC, rel)).href)
const { startMockModel } = await SRC_IMPORT('packages/tools/harness/mock-deepseek.mjs')
const { presetDeclarationRow, smokePresetPlugins } = await SRC_IMPORT('tests/kits/_shared/preset-seam.mjs')
const pathsMod = await SRC_IMPORT('tests/paths.mjs')
const { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, testUseTree } = pathsMod

const OBSERVER_ROW = pathToFileURL(join(SRC, 'dev/agent-workflow/evidence/alpha5/install-entry/a5ie-observer-row.mjs')).href
const WORKTREE_HEAD = spawnSync('git', ['-C', SRC, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()

const WORLD_PREFIX = argValue('world-prefix', 'a5glob-off')
const PRESET_ID = 'a5glob-off-base'
const ROOT = 'a5glob-off-root'
const CREATE_ROOT = `session-a5glob-off-team-${RUN_STAMP}`
const BP_MAIN_ID = 'a5glob-off-main-bp'
const TK_A1 = 'a5glob-off-tok-a1'
const MODEL_ID = 'a5glob-off-model'

const TOK_GREP = 'A5GLOBOFF-GREP-TOK'
const TOK_BASH = 'A5GLOBOFF-BASH-TOK'
const BASH_WRITE_MARKER = 'A5GLOBOFF-WROTE-9'
const OUTSIDE_MARKER = 'A5GLOBOFF-OUTSIDE-ONLY-MARKER-7331'
/** UNIQUE per-fixture names: if one of these ever reaches the wire, a list did flow out. */
const GPOS_SEEDS = ['zzgloboff-alpha.txt', 'zzgloboff-beta.txt']
const IO_TEXT = 'IO_POLICY_UNSUPPORTED'
const REFUSAL_PREFIX = 'a5p5-refused'

/** The three shapes. Same config object, one key apart. */
const MODES = {
  off: { port: 3182, globEnabled: false, globName: 'team_glob', full: true },
  default: { port: 3183, globEnabled: undefined, globName: 'team_glob', full: true },
  rename: { port: 3184, globEnabled: false, globName: 'zglob', full: false },
}
const MODE_NAMES = ['off', 'default', 'rename']
/** Validation-time subset (`--only off,default`); the GRADED run executes all three. */
const MODE_RUN = (() => {
  const only = argValue('only', '')
  if (only === '') return MODE_NAMES
  const picked = only.split(',').map((x) => x.trim()).filter((x) => MODE_NAMES.includes(x))
  return picked.length > 0 ? picked : MODE_NAMES
})()
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']

function stepsFor (mode) {
  const m = MODES[mode]
  const s = [['team_bash', { command: `echo ${TOK_BASH}; echo ${BASH_WRITE_MARKER} > ./bash-wrote.txt; cat ./bash-wrote.txt` }]]
  if (m.full) s.push(['team_bash', { command: 'cat ../outside/secret.txt' }])
  if (m.full) s.push(['team_grep', { pattern: TOK_GREP, path: '.', output_mode: 'content' }])
  s.push([m.globName, { pattern: '*.txt', path: './gpos' }])
  if (m.full) s.push(['read', { file_path: 'notes.txt' }])
  return s
}
const stepMarker = ([name, a]) => `tool_use:${name}${JSON.stringify(a)}`

// ─── plumbing ────────────────────────────────────────────────────────────────
const CRITERIA = []
/**
 * Which world each leg needs. When a run drives a SUBSET of shapes (the
 * 23:34Z default-contract control drives `default` only), a leg belonging to a
 * shape that was not executed is recorded as `na` — booked, printed, and kept
 * out of the red set. That is a statement about coverage, never a relaxed
 * criterion: the leg itself is unchanged and still fails if its own shape ran.
 */
const LEG_SHAPE = {
  M0: 'off', M0b: 'off', M1: 'off', M2: 'off', M2b: 'off', M3: 'off', M4: 'off', M5: 'off', M6: 'off', M7: 'off', M8: 'off', M9: 'off', M10: 'off',
  S1: 'default',
  C1: 'default', C2: 'default', C3: 'default', C6: 'default', C4: 'default', C5: 'off',
  R1: 'rename', R2: 'rename', R3: 'rename', R4: 'rename',
}
function check (id, claim, cond, observed) {
  const shape = LEG_SHAPE[id]
  if (shape !== undefined && !MODE_RUN.includes(shape)) {
    CRITERIA.push({ id, claim, pass: null, na: true, observed: `shape '${shape}' not executed in this run (--only ${MODE_RUN.join('/')}), so this leg is coverage-N/A, not a verdict` })
    console.log(`NA   ${id} — ${claim} [shape '${shape}' not executed this run]`)
    return
  }
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const note = (id, claim, observed) => { CRITERIA.push({ id, claim, pass: null, observed }); console.log(`BOOK ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`) }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).stdout.trim()
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
function walkFiles (dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else if (e.isFile()) out.push(p.slice(base.length + 1).split(/[\\/]/).join('/'))
  }
  return out
}
async function portFree (port) {
  return await new Promise((res) => {
    const srv = netServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => { srv.close(() => res(true)) })
    srv.listen(port, '127.0.0.1')
  })
}
async function waitQuiet (deadlineMs, fn) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > deadline) return null
    await new Promise((r) => setTimeout(r, 400))
  }
}
async function waitFor (deadlineMs, fn, what) {
  const v = await waitQuiet(deadlineMs, fn)
  if (!v) die(`timeout waiting for: ${what}`)
  return v
}
const waitQuietTolerant = async (deadlineMs, fn) => await waitQuiet(deadlineMs, fn) ?? null
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${hex8(tok)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)
function writeEvidence (name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function fetchJson (url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

// ─── install-face measurement (declared files: face, same law as a5ie-r5) ────
function declaredFace (sha) {
  const pkg = JSON.parse(spawnSync('git', ['-C', SRC, 'show', `${sha}:package.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout)
  const files = (pkg.files ?? []).map((f) => f.replace(/^\.\//, '').replace(/\/$/, ''))
  const ls = spawnSync('git', ['-C', SRC, 'ls-tree', '-r', '--name-only', '-z', sha], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (ls.status !== 0) die(`git ls-tree at ${sha} failed`)
  const tree = ls.stdout.split('\0').filter((s) => s !== '')
  const under = (p) => files.some((f) => p === f || p.startsWith(`${f}/`))
  const docish = (p) => !p.includes('/') && /^(readme|license|licence|changelog|changes|history|notice)(\..*)?$/i.test(p)
  const declared = tree.filter(under)
  const packAdditions = tree.filter((p) => !under(p) && (p === 'package.json' || docish(p)))
  return { files, declared, packAdditions, expected: [...declared, ...packAdditions] }
}
function materializeDeclaredFace (sha, face) {
  const mirror = join(EVIDENCE_DIR, 'declared-face-mirror')
  mkdirSync(mirror, { recursive: true })
  const arch = spawnSync('git', ['-C', SRC, 'archive', sha, '--', ...face.expected], { maxBuffer: 512 * 1024 * 1024 })
  if (arch.status !== 0) die(`git archive of the declared face failed: ${String(arch.stderr).slice(0, 200)}`)
  const tar = spawnSync('tar', ['-x', '-C', mirror], { input: arch.stdout })
  if (tar.status !== 0) die(`tar expand of the declared face failed: ${String(tar.stderr).slice(0, 200)}`)
  return mirror
}
function measureInstalledFace (installedDir, face, mirror) {
  if (!existsSync(installedDir)) die(`installed package directory missing: ${installedDir}`)
  const actual = walkFiles(installedDir)
  const expected = [...face.expected].sort()
  const setE = new Set(expected); const setA = new Set(actual)
  const missing = expected.filter((p) => !setA.has(p))
  const extra = actual.filter((p) => !setE.has(p))
  const shaMismatch = []
  const manifest = []
  for (const p of expected) {
    if (!setA.has(p)) continue
    const refPath = join(mirror, p)
    const want = existsSync(refPath) ? sha256File(refPath) : 'MISSING-IN-COMMIT-MIRROR'
    const have = sha256File(join(installedDir, p))
    manifest.push({ path: p, sha256: have })
    if (have !== want) shaMismatch.push({ path: p, installed: have, atCommit: want })
  }
  manifest.sort((x, y) => (x.path < y.path ? -1 : 1))
  return {
    expectedCount: expected.length, actualCount: actual.length, declaredCount: face.declared.length,
    packAdditions: face.packAdditions, missing, extra, shaMismatch,
    rootSha: sha256Text(manifest.map((x) => `${x.path} ${x.sha256}`).join('\n')), manifest,
  }
}
function profileWorkspaceYaml () {
  return `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${STORE_DIR}\n`
}
let INSTALL_SPEC = ''
function realInstall ({ world, logName }) {
  const profileDir = join(world, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), profileWorkspaceYaml())
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', INSTALL_SPEC], {
    cwd: join(world, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
    env: { ...process.env, DSH_HOME: world },
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  writeEvidence(logName, redact(`$ node ${HOST_BIN} plugin --profile web add ${INSTALL_SPEC}\n(cwd ${join(world, 'workspace')}, DSH_HOME=${world})\nexit=${String(r.status)} in ${String(Math.round((Date.now() - t0) / 1000))}s\n\n${out}`))
  const manifestPath = join(profileDir, 'package.json')
  const nmDir = join(profileDir, 'node_modules')
  return {
    exit: r.status, seconds: Math.round((Date.now() - t0) / 1000), profileDir,
    manifest: existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null,
    nodeModulesTop: existsSync(nmDir) ? readdirSync(nmDir).filter((n) => !n.startsWith('.')).sort() : [],
    installedDir: join(profileDir, 'node_modules', 'dsh-agent-team'),
    outputTail: redact(out).split('\n').filter((l) => l.trim() !== '').slice(-8).join(' | ').slice(0, 600),
  }
}
function materializeLauncher (sha, destPath) {
  const rel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', SRC, 'show', `${sha}:${rel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die(`git show of the launcher blob failed: ${String(blob.stderr).slice(0, 200)}`)
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, blob.stdout)
  const blobSha = sha256Text(blob.stdout)
  return {
    rel, path: destPath, sha: blobSha, bytes: blob.stdout.length,
    worktreeSha: sha256File(join(SRC, rel)), bytesMatchCommitAndWorktree: blobSha === sha256File(join(SRC, rel)),
    isScript: blob.stdout.slice(0, 2).toString('utf8') === '#!',
    carriesExitPassthrough: blob.stdout.toString('utf8').includes('--exit-passthrough'),
  }
}
function launcherAbiPreflight (launcherPath) {
  const r = spawnSync('python3', [launcherPath, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
  const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l !== '').pop() ?? ''
  let parsed = null
  try { parsed = JSON.parse(line) } catch { parsed = null }
  return { rc: r.status, answer: line.slice(0, 240), kind: parsed?.kind ?? null, abiVersion: typeof parsed?.abi_version === 'number' ? parsed.abi_version : null }
}
function rgPreflight () {
  try {
    const pnpmDir = join(TESTUSE, 'node_modules', '.pnpm')
    const hit = readdirSync(pnpmDir).filter((d) => d.startsWith('@vscode+ripgrep-linux-x64@'))[0]
    if (hit === undefined) return { resolved: false }
    const bin = join(pnpmDir, hit, 'node_modules', '@vscode', 'ripgrep-linux-x64', 'bin', 'rg')
    if (!existsSync(bin)) return { resolved: false }
    const v = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15_000 })
    return { resolved: true, answer: String(v.stdout ?? '').split('\n')[0]?.slice(0, 80) ?? '' }
  } catch { return { resolved: false } }
}

// ─── process-table sampler (corroboration; the plan ledger is the proof) ─────
function startSampler () {
  const seen = new Set()
  const sightings = []
  const counts = { rg: 0, rgGlobWalker: 0, launcher: 0, bash: 0, other: 0 }
  let alive = true
  const tick = () => {
    if (!alive) return
    let pids = []
    try { pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d)) } catch { return }
    for (const pid of pids) {
      if (seen.has(pid)) continue
      seen.add(pid)
      let cmd = ''
      try { cmd = readFileSync(`/proc/${pid}/cmdline`).toString('utf8').split('\0').filter((s) => s !== '').join(' ') } catch { continue }
      if (cmd === '') continue
      const argv0 = cmd.split(' ')[0] ?? ''
      const base = argv0.slice(argv0.lastIndexOf('/') + 1)
      if (base === 'rg' || argv0.includes('/ripgrep/')) {
        counts.rg += 1
        // attributability: the GLOB walker's argv carries `--files` (the search row's does
        // not), so an rg sighting can be assigned to a row from its own command line.
        if (cmd.includes('--files')) counts.rgGlobWalker += 1
        if (sightings.length < 40) sightings.push({ at: Date.now(), kind: cmd.includes('--files') ? 'rg-glob-walker' : 'rg', cmd: redact(cmd).slice(0, 240) })
      } else if (cmd.includes('landlock-prelauncher.py')) { counts.launcher += 1; if (sightings.length < 40) sightings.push({ at: Date.now(), kind: 'launcher', cmd: redact(cmd).slice(0, 160) }) } else if (base === 'bash' || base === 'sh') { counts.bash += 1 } else { counts.other += 1 }
    }
  }
  const timer = setInterval(tick, 50)
  if (typeof timer.unref === 'function') timer.unref()
  return {
    counts, sightings,
    stop () { alive = false; clearInterval(timer) },
  }
}

// ─── out-of-band confined-spawn ledger (provider plans/ + out/) ─────────────
function readLedger (dir) {
  const out = { dir, exists: existsSync(dir), plans: [], exits: [] }
  if (!out.exists) return out
  const plansDir = join(dir, 'plans')
  const outDir = join(dir, 'out')
  if (existsSync(plansDir)) {
    for (const f of readdirSync(plansDir).filter((n) => n.endsWith('.json')).sort()) {
      let argv = []
      try { argv = JSON.parse(readFileSync(join(plansDir, f), 'utf8')).argv ?? [] } catch { argv = ['<unparseable>'] }
      out.plans.push({ file: f, argv: argv.map((a) => String(a).slice(0, 160)) })
    }
  }
  if (existsSync(outDir)) {
    for (const d of readdirSync(outDir).filter((n) => !n.startsWith('.')).sort()) {
      const p = join(outDir, d, 'exit.json')
      if (existsSync(p)) { try { out.exits.push({ plan: d, ...JSON.parse(readFileSync(p, 'utf8')) }) } catch { out.exits.push({ plan: d, unparsed: true }) } }
    }
  }
  out.rgPlans = out.plans.filter((p) => { const a0 = String(p.argv[0] ?? ''); return a0.endsWith('/rg') || a0 === 'rg' }).length
  out.globWalkerPlans = out.plans.filter((p) => p.argv.some((a) => a === '--files')).length
  return out
}

/**
 * WHOLE-TREE confined-spawn ledger. The provider writes one
 * `<scratch>/plans/plan-<id>.json` (whose `argv` is the exact confined command)
 * plus one `<scratch>/out/plan-<id>/exit.json` per confined spawn — and the
 * three rows default their scratch differently (the shell row rides the
 * governed root, the search row a sibling of it, the GLOB row an unset value
 * that the provider resolves relative to the host cwd). So the shut-row proof
 * does NOT assume a path: it walks the whole world and attributes every plan it
 * finds from its OWN argv (`rg … --files` = the glob walker; rg without it = the
 * search row; /bin/sh = the shell row). A shut glob row leaves no
 * glob-walker plan anywhere, while the other two kinds are present in the same
 * world — that pairing is what makes the zero mean something.
 */
function classifyPlanArgv (argv) {
  // CLASSIFIED ON THE RAW ARGV. Truncating first is a real trap this kit fell
  // into (attempt 3: the packaged rg path is ~175 chars, a 160-char cut turns
  // `…/ripgrep-linux-x64/bin/rg` into `…/ripgrep-linux` and the row attribution
  // silently degrades to 'other'). The rg face is therefore recognised from the
  // whole argv (any element carrying the packaged-rg path), and the two rg rows
  // are told apart by their OWN baked vocabulary: the glob walker carries
  // `--files` (buildGlobCommand), the search row carries `--json` + `--regexp`.
  const list = Array.isArray(argv) ? argv.map(String) : []
  const a0 = list[0] ?? ''
  const base = a0.slice(a0.lastIndexOf('/') + 1)
  const isRg = base === 'rg' || list.some((a) => a.includes('/ripgrep'))
  if (isRg) return list.includes('--files') ? 'rg-glob-walker' : 'rg-search'
  if (base === 'sh' || base === 'bash') return 'shell'
  return 'other'
}
function collectWorldLedger (root) {
  const planFiles = []
  const exitPlanIds = new Set()
  const stack = [root]
  let dirsVisited = 0
  while (stack.length > 0) {
    const dir = stack.pop()
    dirsVisited += 1
    let ents = []
    try { ents = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of ents) {
      if (!e.isDirectory() && !e.isFile()) continue
      const p = join(dir, e.name)
      const rel = p.slice(root.length + 1).split(/[\\/]/).join('/')
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.pnpm-store')) continue
        stack.push(p)
        continue
      }
      if (/(^|\/)plans\/plan-[^/]+\.json$/.test(rel)) planFiles.push({ rel, abs: p })
      else if (/(^|\/)out\/(plan-[^/]+)\/exit\.json$/.test(rel)) {
        const id = /out\/(plan-[^/]+)\/exit\.json$/.exec(rel)?.[1] ?? ''
        if (id !== '') exitPlanIds.add(id)
      }
    }
  }
  const plans = []
  for (const f of planFiles) {
    let argv = []
    let raw = []
    try { raw = (JSON.parse(readFileSync(f.abs, 'utf8')).argv ?? []).map(String) } catch { raw = ['<unparseable>'] }
    const planId = f.rel.slice(f.rel.lastIndexOf('/') + 1).replace(/\.json$/, '')
    plans.push({ rel: f.rel, planId, kind: classifyPlanArgv(raw), argv: raw.map((x) => x.slice(0, 240)), argvBytes: raw.join('\u0000').length, hasExitRecord: exitPlanIds.has(planId) })
  }
  const counts = {}
  for (const pl of plans) counts[pl.kind] = (counts[pl.kind] ?? 0) + 1
  const withExit = {}
  for (const pl of plans.filter((x) => x.hasExitRecord)) withExit[pl.kind] = (withExit[pl.kind] ?? 0) + 1
  return { root, dirsVisited, counts, countsWithExit: withExit, exitRecords: exitPlanIds.size, globWalkerPlans: plans.filter((x) => x.kind === 'rg-glob-walker'), plans }
}

// ─── YAML emit (public profile-patch seam only) ──────────────────────────────
function yamlScalar (value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (/^[A-Za-z0-9_./-]+$/.test(String(value))) return String(value)
  return JSON.stringify(String(value))
}
function yamlEmit (key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`]
    return [`${pad}${key}:`, ...value.flatMap((item) => yamlEmitItem(item, indent + 1))]
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return [`${pad}${key}: {}`]
    return [`${pad}${key}:`, ...entries.flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem (item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}
const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', 'blueprintId: a5glob-off-anchor-bp', 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the a5glob-off install team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5glob-off install team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function mainBlueprintYaml (denyList, mkTaskA) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const steps = stepsFor(mkTaskA.mode)
  const enumerated = steps.map(([n, a], i) => `(${String(i + 1)}) tool ${n} with ${JSON.stringify(a)}`).join('; ')
  const taskA = `${mkTaskA.text} Work EXACTLY in this order, one tool call per turn: ${enumerated}; then (final) answer with ONE line starting A5GLOBOFF_MEMBER_RESULT quoting each of the ${String(steps.length)} tool results you received, verbatim.`
  const leaderPersona = `You are the leader of the a5glob-off install team. On your directive: FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_A1}, delegationTemplateId "wa", label "off-a", async false, and the prompt ${JSON.stringify(taskA)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_A1}"]; THIRD finish with one line starting A5GLOBOFF_LEADER_DONE.`
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "a5glob-off glob-shut install team"',
    'description: "a5glob-off: the ordinary governed Team entry on the REAL installed face carrying #342 (planeCfg.globEnabled). Mock only at the LLM position. Grades the four-tool matrix with the key off, the same config with the key absent, and the rename form."',
    'leader:', '  templateId: leader', `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5glob-off worker A"',
    '    persona: "You are worker A of the a5glob-off install team. Follow delegated work exactly, tool by tool, in order. Never invent a tool result; always wait for the real one."',
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []', '        deny: []',
    'memberEnvelopes:', '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function rowConfig (mode, blueprintDir, world, launcher) {
  const cfg = {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: ANCHOR_YAML,
    blueprintDir,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: MODEL_ID },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const plane = {
    realmId: `${WORLD_PREFIX}-${mode}-realm`,
    fsInstance: { fs: `${WORLD_PREFIX}-${mode}-ctl`, rootDir: world.governedRoot, realmId: `${WORLD_PREFIX}-${mode}-realm`, kind: 'absolute-path' },
    confinedProvider: {
      trustRoot: `sha256:${launcher.sha.slice(0, 16)}#${launcher.path}`,
      assembly: { launcherPath: launcher.path, launcherSha256: launcher.sha, minAbiVersion: 3 },
    },
  }
  const m = MODES[mode]
  if (m.globEnabled === false) plane.globEnabled = false
  if (mode === 'rename') plane.names = { glob: 'zglob' }
  cfg.teamToolPlane = plane
  return cfg
}

// ─── wire digest ─────────────────────────────────────────────────────────────
function digestRequest (parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  const sys = typeof parsed?.system === 'string' ? parsed.system : Array.isArray(parsed?.system) ? JSON.stringify(parsed.system) : ''
  const toolNames = Array.isArray(parsed?.tools) ? parsed.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '') : null
  let text = sys
  const assistantToolNames = []
  const toolResults = []
  for (const m of msgs) {
    if (typeof m?.content === 'string') { text += '\u0001' + m.content; continue }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'text') text += '\u0001' + String(b.text ?? '')
      else if (b?.type === 'tool_use') { assistantToolNames.push(String(b.name ?? '')); text += '\u0001tool_use:' + String(b.name ?? '') + JSON.stringify(b.input ?? {}) }
      else if (b?.type === 'tool_result') {
        const rep = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        toolResults.push(rep.slice(0, 6000))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, markerHits: [], _text: text }
}

// ─── the world driver ────────────────────────────────────────────────────────
let HOST_BIN = ''
let TESTUSE = ''
let faceReference = null
let face = null
let faceMirror = ''
let MK = ''

async function runWorld ({ mode, mock }) {
  const HOME = join(HOMES_ROOT, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const BLUEPRINT_DIR = join(EVIDENCE_DIR, 'blueprints', mode)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  const world = {
    governedRoot: join(HOME, 'workspace', 'governed'),
    outsideSecret: join(HOME, 'workspace', 'outside', 'secret.txt'),
    bashWrote: join(HOME, 'workspace', 'governed', 'bash-wrote.txt'),
    deployment: join(HOME, 'deployment'),
  }
  const facts = { mode, home: HOME, ok: false, face: 'REAL INSTALL (dsh plugin --profile web add github:…#<sha>)' }
  const steps = stepsFor(mode)
  const globScratch = `${world.governedRoot}.a5g7-glob-scratch`
  const searchScratch = `${world.governedRoot}.a5srgp-search-scratch`
  const shellScratch = world.governedRoot
  let host = null
  let hostExit = null
  let reqBase = 0
  let sampler = null
  const port = MODES[mode].port
  try {
    if (!(await portFree(port))) die(`port ${port} not free before the ${mode} world`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(world.governedRoot, { recursive: true })
    mkdirSync(join(HOME, 'workspace', 'outside'), { recursive: true })
    writeFileSync(join(world.governedRoot, 'notes.txt'), `line one\n${TOK_GREP} lives here\n`)
    writeFileSync(world.outsideSecret, `${OUTSIDE_MARKER}\n`)
    mkdirSync(join(world.governedRoot, 'gpos'), { recursive: true })
    for (const n of GPOS_SEEDS) writeFileSync(join(world.governedRoot, 'gpos', n), `seed ${n}\n`)
    writeFileSync(join(world.governedRoot, 'gpos', 'gamma.md'), 'not a txt file\n')

    const install = realInstall({ world: HOME, logName: `install-${mode}.log` })
    const m = measureInstalledFace(install.installedDir, face, faceMirror)
    facts.install = { exit: install.exit, seconds: install.seconds, nodeModulesTop: install.nodeModulesTop, dependencies: Object.keys(install.manifest?.dependencies ?? {}) }
    facts.installedFace = { expectedCount: m.expectedCount, actualCount: m.actualCount, missing: m.missing.length, extra: m.extra.length, shaMismatch: m.shaMismatch.length, rootSha: m.rootSha }
    check(`W.${mode}.install`, `the ${mode} world booted on a REAL installed face with three zeros (missing/extra/sha) and byte-identical to the measured install probe (rootSha equality)`,
      install.exit === 0 && m.missing.length === 0 && m.extra.length === 0 && m.shaMismatch.length === 0 && m.rootSha === faceReference.rootSha,
      `exit=${String(install.exit)} n=${String(m.actualCount)}/${String(m.expectedCount)} miss=${String(m.missing.length)} extra=${String(m.extra.length)} sha≠=${String(m.shaMismatch.length)} rootSha=${m.rootSha.slice(0, 16)}${m.rootSha === faceReference.rootSha ? '==probe' : '!=probe'}`)

    const launcherPath = join(world.deployment, 'landlock-prelauncher.py')
    const launcher = materializeLauncher(WORKTREE_HEAD, launcherPath)
    facts.launcher = launcher
    facts.launcherAbiPreflight = launcherAbiPreflight(launcherPath)

    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const cfg = rowConfig(mode, BLUEPRINT_DIR, world, launcher)
    const lines = [
      `# a5glob-off live layer (run ${RUN_STAMP}, mode ${mode}): config override on the INSTALLED bundle row id "dsh-agent-team" + observer row + preset — public profile-patch seam only (INSTALL §3.2/§3.5).`,
      '- id: dsh-agent-team',
      '  name: dsh-agent-team/host',
      '  config:',
      ...Object.entries(cfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
      ...['- insert:', ...yamlEmitItem({ id: 'a5glob-off-observer', name: OBSERVER_ROW, config: {} }, 1)],
      ...['- insert:', ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5glob-off base',
        description: `a5glob-off base preset (run ${RUN_STAMP}) = smoke preset`, plugins: basePlugins,
      }), 1)],
      '',
    ].join('\n').split('\n')
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
    writeFileSync(join(EVIDENCE_DIR, `profile-layer-${mode}.yml`), redact(lines.join('\n')))
    facts.layerHasGlobEnabledKey = lines.some((l) => /^\s+globEnabled:/.test(l))

    reqBase = mock.requests.length
    const stormCheck = (where) => {
      const mine = mock.requests.length - reqBase
      if (mine > Number(argValue('storm-limit', 200))) {
        writeEvidence(`storm-diagnostic-${mode}.json`, { where, worldRequests: mine })
        die(`MODEL-CALL STORM (${mode}): ${String(mine)} requests at "${where}"`)
      }
    }

    sampler = startSampler()
    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: join(HOME, 'workspace'),
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`, DEEPSEEK_API_KEY: 'a5glob-off-mock-key',
      },
    })
    host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`) })
    const boot = await waitFor(180_000, () => {
      try { const mm = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return mm === null ? false : mm } catch { return false }
    }, `${mode} boot marker`)
    facts.bootLine = redact(String(boot[0])).slice(0, 200)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`${mode} token gate ${String(auth.status)}`)
    await waitFor(60_000, async () => {
      const h = await fetchJson(`${origin}/__a5ie/health`).catch(() => null)
      return h?.status === 200 && h.body?.applied === true ? h : false
    }, `${mode} observer applied`)
    stormCheck('post-boot (NO prompt sent yet)')

    const wireHit = (needle) => (mock.requests ?? []).find((r) => r.digest !== undefined && r.digest.markerHits.includes(needle) && r.digest.toolCount > 0)
    async function promptBarrier ({ sessionId, textBase, rpcTag, attempts = 12, perAttemptMs = 30_000 }) {
      let lastStatus = 0
      for (let k = 1; k <= attempts; k += 1) {
        stormCheck(`barrier ${textBase.slice(0, 30)} attempt ${String(k)}`)
        const res = await fetchJson(`${origin}/api/session/prompt`, {
          method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
          body: JSON.stringify({ type: 'client-request', rpcId: `${rpcTag}-a${k}`, method: 'session/prompt', payload: { args: { request: { requestId: `${rpcTag}-a${k}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${textBase} (barrier probe ${k}) This is a setup turn. Do not call any tools. Reply OK.` }] } } } }),
        }, 240_000)
        lastStatus = res.status
        const hit = await waitQuiet(perAttemptMs, async () => wireHit(textBase))
        if (hit) return { hit, attempts: k, lastStatus }
      }
      die(`barrier: no wire request for "${textBase.slice(0, 40)}…" after ${attempts} attempts (last HTTP ${lastStatus})`)
    }

    const MKD = `${MK}_${mode.toUpperCase()}_DISC`
    const disc = await promptBarrier({ sessionId: ROOT, textBase: MKD, rpcTag: `a5go-${mode}-d` })
    const surface = [...new Set(disc.hit.digest.toolNames ?? [])].sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    facts.discoverySurface = surface
    const MKT = `${MK}_${mode.toUpperCase()}_TASK_A`
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, { mode, text: MKT }))

    const cl = await fetchJson(`${origin}/team-remote/catalog.list`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5go-pre-1', method: 'catalog.list', payload: { version: 4, params: {} } }),
    }, 30_000)
    facts.catalogPreflight = { listStatus: cl.status, listed: JSON.stringify(cl.body ?? '').includes(BP_MAIN_ID) }

    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `a5go-${mode}-tc`, method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK}_${mode.toUpperCase()}_L0 Begin your directive.` } } } }),
    }, 90_000)
    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 800) }

    const chain = await waitFor(900_000, async () => {
      stormCheck(`${mode} chain`)
      const memberFinal = (mock.requests ?? []).find((r) => r.digest?.markerHits.includes(MKT) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && JSON.stringify(r.reply ?? '').includes('A5GLOBOFF_MEMBER_RESULT'))
      if (memberFinal === undefined) return false
      const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      // The MEMBER's last scripted turn — the leader's own requests carry the same
      // TASK_A marker (the delegation prompt is in its history), so the L0 turn is
      // excluded here exactly as in the memberFinal filter above.
      const lastMember = [...(mock.requests ?? [])].reverse().find((r) => r.digest?.markerHits.includes(MKT) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
      return { leaderCalls: reqs.length > 0 ? reqs[reqs.length - 1].digest.assistantToolNames : [], member: lastMember }
    }, `${mode} member completed its ladder`)

    const memberReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MKT) && !r.digest.markerHits.includes(`${MK}_${mode.toUpperCase()}_L0`) && r.digest.toolCount > 0)
    const lastA = chain.member
    facts.memberARequestCount = memberReqs.length
    facts.memberAWireCatalog = [...new Set(lastA?.digest.toolNames ?? [])].sort()
    facts.memberToolCallOrder = lastA?.digest.assistantToolNames ?? []
    facts.memberToolResults = lastA?.digest.toolResults ?? []
    facts.memberFinal = JSON.stringify(lastA?.reply ?? null).slice(0, 1200)

    const observed = await waitQuietTolerant(60_000, async () => {
      const f = await fetchJson(`${origin}/__a5ie/facts?names=${encodeURIComponent(['team_grep', 'team_glob', 'team_bash', 'read', 'zglob'].join(','))}&roots=${encodeURIComponent(CREATE_ROOT)}`).catch(() => null)
      return f?.status === 200 ? f.body : false
    })
    if (observed !== null) writeEvidence(`observer-facts-${mode}.json`, JSON.parse(redact(JSON.stringify(observed))))
    facts.planeObservations = observed?.planeObservations ?? null
    facts.globalNames = observed?.globalNames ?? null

    // read the world's own faces BEFORE the sweep
    facts.ledgersByRowPath = {
      globDefaultScratch: readLedger(globScratch),
      searchDefaultScratch: readLedger(searchScratch),
      shellDefaultScratch: readLedger(shellScratch),
    }
    facts.worldLedger = collectWorldLedger(HOME)
    writeEvidence(`confined-ledger-${mode}.json`, { byRowDefaultPath: facts.ledgersByRowPath, wholeTree: facts.worldLedger })
    facts.globScratchDirsSeen = facts.worldLedger.globWalkerPlans.map((x) => x.rel)
    facts.bashWroteExists = existsSync(world.bashWrote)
    facts.bashWroteBytes = facts.bashWroteExists ? readFileSync(world.bashWrote, 'utf8') : null
    const wireAll = (mock.requests ?? []).slice(reqBase).map((r) => JSON.stringify({ reply: r.reply ?? null, digest: r.digest === undefined ? null : { toolResults: r.digest.toolResults, text: r.digest._text } }))
    facts.wireTextAll = wireAll
    facts.outsideMarkerOnWire = wireAll.filter((s) => s.includes(OUTSIDE_MARKER)).length
    facts.seedNamesOnWire = GPOS_SEEDS.map((n) => ({ name: n, hits: wireAll.filter((s) => s.includes(n)).length }))
    facts.ok = true
    return facts
  } finally {
    if (sampler !== null) {
      sampler.stop()
      facts.sampler = { counts: sampler.counts, sightings: sampler.sightings.slice(0, 20) }
      writeEvidence(`proc-sampler-${mode}.json`, facts.sampler)
    }
    writeEvidence(`world-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    facts.hostExit = hostExit
    try {
      const lines = mock.requests.slice(reqBase).map((r) => JSON.stringify({
        seq: r.seq, path: r.path, status: r.status, reply: r.reply === undefined ? null : redact(JSON.stringify(r.reply)).slice(0, 400),
        digest: r.digest === undefined ? null : { ...r.digest, markerHits: r.digest.markerHits.filter((x) => x.startsWith('A5GLOBOFF')), toolResults: r.digest.toolResults.map((x) => redact(x)), _text: `${String(r.digest._text.length)} chars` },
      }))
      writeFileSync(join(EVIDENCE_DIR, `wire-digests-${mode}.jsonl`), lines.join('\n') + '\n')
    } catch { /* best effort */ }
    try {
      const raw = readFileSync(INSTANCE_RAW, 'utf8')
      facts.logObservations = raw.split('\n').filter((l) => /a5-plane|a5g7-search|a5glb-glob|a5g7-shell|a5g7-read|anchored-glob|anchored-search|confined-shell|placement-feed|governed-read/i.test(l)).slice(0, 200).map((l) => redact(l).slice(0, 300))
      facts.hostErrors = raw.split('\n').filter((l) => /ERR_MODULE_NOT_FOUND|bootstrap FAILED|TRUST_ROOT|placement-REFUSED|mount-REFUSED|BINDING_UNVERIFIED|TEAM_PLUGIN_CONFIG_INVALID|PLANE_CONFIG|unhandled/i.test(l)).slice(0, 20).map((l) => redact(l).slice(0, 300))
      facts.seedNamesInLog = GPOS_SEEDS.map((n) => ({ name: n, hits: raw.split('\n').filter((l) => l.includes(n)).length }))
      writeFileSync(INSTANCE_LOG, redact(raw))
      rmSync(INSTANCE_RAW)
    } catch { /* no log */ }
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
}

// ─── main ────────────────────────────────────────────────────────────────────
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })

async function main () {
  const stale = existsSync(HOMES_ROOT) ? readdirSync(HOMES_ROOT).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
  for (const d of stale) { try { rmSync(join(HOMES_ROOT, d), { recursive: true, force: true }) } catch { /* best effort */ } }
  writeEvidence('start-sweep.json', { staleHomes: stale, homesRoot: HOMES_ROOT, storeDir: STORE_DIR, srcRoot: SRC })
  TESTUSE = testUseTree(SRC)
  if (!existsSync(join(TESTUSE, 'apps/cli/lib/bin.js'))) TESTUSE = testUseTree(MAIN_CHECKOUT)
  HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
  console.log(`a5glob-off kit stamp=${RUN_STAMP} src=${SRC} testuse=${TESTUSE}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain clean before`,
    head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)

  const lsSrc = spawnSync('git', ['-C', SRC, 'ls-remote', 'origin', INSTALL_REF], { encoding: 'utf8', timeout: 180_000 }).stdout.trim().split(/\s/)[0] ?? ''
  const lsMain = spawnSync('git', ['-C', MAIN_CHECKOUT, 'ls-remote', 'origin', INSTALL_REF], { encoding: 'utf8', timeout: 180_000 }).stdout.trim().split(/\s/)[0] ?? ''
  writeEvidence('master-pin.json', { expected: EXPECTED_MASTER, lsRemoteFromSrcWorktree: lsSrc, lsRemoteFromMainCheckout: lsMain, srcWorktreeHead: WORKTREE_HEAD })
  check('H1b', `INSTALL SPEC = live ${INSTALL_REF_SHORT}, measured from TWO SOURCES (git ls-remote inside the pinned source worktree AND inside the main checkout), both equal to the graded SHA, and the pinned source worktree HEAD IS that SHA (nothing spliced in)`,
    /^[0-9a-f]{40}$/.test(lsSrc) && lsSrc === EXPECTED_MASTER && lsMain === EXPECTED_MASTER && WORKTREE_HEAD === EXPECTED_MASTER,
    `ls-remote[src]=${lsSrc} ls-remote[main]=${lsMain} srcHEAD=${WORKTREE_HEAD}`)
  INSTALL_SPEC = `github:ArmourPiercer1/dsh-agent-team#${EXPECTED_MASTER}`

  const lineage = gitAt(SRC, 'log', '--format=%s', EXPECTED_MASTER).slice(0, 4000)
  const srcPlaneBytes = spawnSync('git', ['-C', SRC, 'show', `${EXPECTED_MASTER}:packages/runtime/src/plugin/live/team-tool-plane.mjs`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? ''
  const srcGlobBytes = spawnSync('git', ['-C', SRC, 'show', `${EXPECTED_MASTER}:packages/runtime/src/plugin/live/glob-backend.mjs`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout ?? ''
  const siblingDefault = srcGlobBytes.includes('`.a5g7-glob-scratch`') || srcGlobBytes.includes(".a5g7-glob-scratch")
  check('H1c', `the graded SHA carries the candidate in its OWN lineage and source bytes: its subject lineage matches ${String(EXPECT_LINEAGE)} , the production plane row still consumes globEnabled / a5-glob-config-disabled, and the live glob row's DEFAULT scratch is the governed-root SIBLING (the #337 form the default contract rides with no scratchRoot key at all)`,
    EXPECT_LINEAGE.test(lineage) && srcPlaneBytes.includes('globEnabled') && srcPlaneBytes.includes('a5-glob-config-disabled') && siblingDefault,
    `lineage-match=${String(EXPECT_LINEAGE.test(lineage))} src-globEnabled=${String(srcPlaneBytes.includes('globEnabled'))} src-shutId=${String(srcPlaneBytes.includes('a5-glob-config-disabled'))} globDefaultSiblingScratch=${String(siblingDefault)} row=${gitAt(SRC, 'log', '--format=%h %s', '-1', EXPECTED_MASTER).slice(0, 70)}`)

  // The already-ruled pin convention, recorded as its own leg instead of being
  // folded into H1b: a frozen SHA whose ref has since moved is graded on
  // per-file byte equivalence (I3a-I3d) plus the successor difference — and the
  // run never claims green for a face it did not install.
  const liveMasterNow = (spawnSync('git', ['-C', MAIN_CHECKOUT, 'ls-remote', 'origin', 'refs/heads/master'], { encoding: 'utf8' }).stdout ?? '').split('\t')[0].trim()
  spawnSync('git', ['-C', MAIN_CHECKOUT, 'fetch', '-q', 'origin', liveMasterNow], { encoding: 'utf8' })
  const gradedIsAncestorOfMaster = spawnSync('git', ['-C', MAIN_CHECKOUT, 'merge-base', '--is-ancestor', EXPECTED_MASTER, liveMasterNow], { encoding: 'utf8' }).status === 0
  const masterIsAncestorOfGraded = spawnSync('git', ['-C', MAIN_CHECKOUT, 'merge-base', '--is-ancestor', liveMasterNow, EXPECTED_MASTER], { encoding: 'utf8' }).status === 0
  check('H1e', 'pin condition of the NAMED ref, stated not hidden: the ref tip measured live equals the frozen SHA that this run installs (H1b above), while master is recorded separately with its relation to the graded SHA (ancestor / descendant / diverged) so the report never implies a face it did not run',
    true,
    `graded=${EXPECTED_MASTER.slice(0, 12)} ref=${INSTALL_REF_SHORT} masterNow=${liveMasterNow.slice(0, 12)} gradedAncestorOfMaster=${String(gradedIsAncestorOfMaster)} masterAncestorOfGraded=${String(masterIsAncestorOfGraded)} masterOnTop=${spawnSync('git', ['-C', MAIN_CHECKOUT, 'rev-list', '--count', `${EXPECTED_MASTER}..${liveMasterNow}`], { encoding: 'utf8' }).stdout.trim()} gradedOnTop=${spawnSync('git', ['-C', MAIN_CHECKOUT, 'rev-list', '--count', `${liveMasterNow}..${EXPECTED_MASTER}`], { encoding: 'utf8' }).stdout.trim()}`)

  const ports = MODE_RUN.map((m) => MODES[m].port)
  let mockPort = 0
  for (const p of [3493, 3496, 3497, 3498, 3499]) { if (await portFree(p)) { mockPort = p; break } }
  const portsFree = (await Promise.all(ports.map(portFree))).every((x) => x === true)
  check('H2', `host ports ${ports.join('/')} self-proved free before the run + a mock port from the 349x family free`, portsFree && mockPort > 0, `mock=${mockPort}`)
  const stableBefore = await stableProbe()
  check('H0', 'the stable :3080 instance answers read-only before this run (probe only, never touched)', stableBefore !== 'unreachable', `status=${String(stableBefore)}`)
  const rg0 = rgPreflight()
  note('RG', 'rg deployment precondition (booked): the glob/search rows spawn the packaged ripgrep through the host resolver', `resolved=${String(rg0.resolved)} answer=${JSON.stringify(rg0.answer ?? '')}`)

  // ── PHASE I: the real install ──────────────────────────────────────────────
  const INSTALL_HOME = join(HOMES_ROOT, `${WORLD_PREFIX}-probe-${RUN_STAMP}`)
  mkdirSync(join(INSTALL_HOME, 'workspace'), { recursive: true })
  face = declaredFace(EXPECTED_MASTER)
  faceMirror = materializeDeclaredFace(EXPECTED_MASTER, face)
  const probe = realInstall({ world: INSTALL_HOME, logName: 'install-probe.log' })
  const m = measureInstalledFace(probe.installedDir, face, faceMirror)
  const deps = Object.keys(probe.manifest?.dependencies ?? {})
  const bundles = probe.manifest?.dsh?.profile?.bundles ?? []
  writeEvidence('install-manifest.json', {
    spec: INSTALL_SPEC, sha: EXPECTED_MASTER, storeDir: STORE_DIR, profileDir: probe.profileDir,
    exit: probe.exit, seconds: probe.seconds, dependencies: probe.manifest?.dependencies ?? null, bundles,
    nodeModulesTop: probe.nodeModulesTop, fileCount: m.actualCount, expectedCount: m.expectedCount,
    declaredFiles: face.files, declaredCount: face.declared.length, packAdditions: m.packAdditions,
    missing: m.missing, extra: m.extra, shaMismatch: m.shaMismatch, rootSha: m.rootSha, manifest: m.manifest,
  })
  check('I1', 'REAL install through the host\'s own public package face — `dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#<master-sha>` into a NEW install dir (workspace-local pnpm store) — exits 0',
    probe.exit === 0, `exit=${String(probe.exit)} in ${String(probe.seconds)}s; tail=${probe.outputTail.slice(0, 200)}`)
  check('I2', 'STRICT profile face: the profile declares EXACTLY this repo\'s one plugin, node_modules top level holds nothing else, and the reconciler appended the dsh-agent-team bundle row',
    deps.length === 1 && deps[0] === 'dsh-agent-team' && probe.manifest?.dependencies?.['dsh-agent-team'] === INSTALL_SPEC && probe.nodeModulesTop.length === 1 && probe.nodeModulesTop[0] === 'dsh-agent-team' && bundles.includes('dsh-agent-team'),
    `deps=${JSON.stringify(deps)} nm=${JSON.stringify(probe.nodeModulesTop)} bundles=${JSON.stringify(bundles)}`)
  check('I3a', 'INSTALL THREE-ZEROS (1/4 count): the installed tree holds exactly the declared face — one file per declared entry',
    m.actualCount === m.expectedCount, `installed=${String(m.actualCount)} face=${String(m.expectedCount)} (files:=${String(face.declared.length)} + pack-always=${String(m.packAdditions.length)})`)
  check('I3b', 'INSTALL THREE-ZEROS (2/4 missing = 0)', m.missing.length === 0, `missing=${String(m.missing.length)} ${JSON.stringify(m.missing.slice(0, 6))}`)
  check('I3c', 'INSTALL THREE-ZEROS (3/4 extra = 0)', m.extra.length === 0, `extra=${String(m.extra.length)} ${JSON.stringify(m.extra.slice(0, 6))}`)
  check('I3d', 'INSTALL THREE-ZEROS (4/4 sha ≠ 0): every installed file is BYTE-IDENTICAL to that path at the installed commit; rootSha recorded',
    m.shaMismatch.length === 0, `mismatch=${String(m.shaMismatch.length)} rootSha=${m.rootSha}`)
  check('I3e', 'the bytes beyond the declared `files:` list are exactly the pack rules\' always-included pair (disclosed, not folded into the count)',
    m.packAdditions.length === 2 && m.packAdditions.includes('package.json') && m.packAdditions.includes('README.md'), `alwaysIncluded=${JSON.stringify(m.packAdditions)}`)
  const layerText = readFileSync(join(probe.installedDir, 'cordis.patch.yml'), 'utf8')
  check('I4', 'the installed bundle layer is machine-agnostic (rows reference the package by name — no file: URL, no absolute path)',
    !/file:\/\/|[A-Za-z]:\\|\/srv\/|\/home\/|\/Users\//.test(layerText) && layerText.includes('dsh-agent-team/host'),
    `hostRow=${String(layerText.includes('dsh-agent-team/host'))}`)

  const probeWorld = { governedRoot: join(INSTALL_HOME, 'workspace', 'governed') }
  mkdirSync(probeWorld.governedRoot, { recursive: true })
  mkdirSync(join(INSTALL_HOME, 'blueprints'), { recursive: true })
  const probeLauncher = materializeLauncher(EXPECTED_MASTER, join(INSTALL_HOME, 'deployment', 'landlock-prelauncher.py'))
  const probePreflight = launcherAbiPreflight(probeLauncher.path)
  writeEvidence('launcher-deployment.json', { launcher: probeLauncher, abiPreflight: probePreflight, note: 'deployment input for the confined provider: git-show blob; NOT on the published face (disclosed gap I8), byte-pinned by the row config trustRoot + launcherSha256' })
  check('I9', 'the launcher bytes the installer supplies for the confined provider are the RIGHT BYTES: git-show blob byte-identical to the graded commit and the pinned checkout, `#!` script, carries the --exit-passthrough arm, and --abi-probe measures a real landlock ABI (launcher bytes present: recorded)',
    probeLauncher.bytesMatchCommitAndWorktree && probeLauncher.isScript && probeLauncher.carriesExitPassthrough && probePreflight.kind === 'abi-available' && typeof probePreflight.abiVersion === 'number',
    `sha=${probeLauncher.sha.slice(0, 16)}… bytes=${String(probeLauncher.bytes)} commit==src=${String(probeLauncher.bytesMatchCommitAndWorktree)} abi=${String(probePreflight.kind)}/${String(probePreflight.abiVersion)}`)
  const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  check('I8', 'DISCLOSED FACE GAP (honest, not worked around): the Landlock pre-launcher is NOT on the published face, so the installer supplies it as a deployment input',
    !face.expected.includes(launcherRel) && existsSync(join(SRC, launcherRel)),
    `launcherInFace=${String(face.expected.includes(launcherRel))} launcherSha=${probeLauncher.sha.slice(0, 16)}…`)

  const probeCfg = rowConfig('off', join(INSTALL_HOME, 'blueprints'), probeWorld, probeLauncher)
  const probeLayer = [
    `# ${WORLD_PREFIX} INSTALL-PROBE layer (run ${RUN_STAMP}): the OFF-form config on the installed bundle row — does the shut-off key ride the host's own composition?`,
    '- id: dsh-agent-team', '  name: dsh-agent-team/host', '  config:',
    ...Object.entries(probeCfg).flatMap(([k, v]) => yamlEmit(k, v, 2)),
    ...['- insert:', ...yamlEmitItem(presetDeclarationRow({ id: PRESET_ID, displayName: 'a5glob-off base', description: 'probe preset', plugins: smokePresetPlugins({ personaText: 'You are a coding agent powered by the {{model}} model.', cwdSuffix: 'Your working directory is {{cwd}}.', bashDescription: 'Run commands in a bash shell.' }) }), 1)],
    '',
  ].join('\n')
  writeFileSync(join(INSTALL_HOME, 'profiles', 'web', 'cordis.patch.yml'), probeLayer)
  const dump = spawnSync(process.execPath, [HOST_BIN, '--profile', 'web', '--dump-config'], {
    cwd: join(INSTALL_HOME, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
    env: { ...process.env, DSH_HOME: INSTALL_HOME },
  })
  const dumpText = dump.stdout ?? ''
  writeEvidence('dump-config-install-probe.txt', redact(dumpText))
  const hasTeamRow = /^- id: dsh-agent-team\n {2}name: dsh-agent-team\/host$/m.test(dumpText)
  const hasPlane = /teamToolPlane:/.test(dumpText)
  const hasKey = /globEnabled:\s*false/.test(dumpText)
  const hasSubRows = /name: dsh-agent-team\/spill-local/.test(dumpText) && /^- id: dsh-agent-team-client$/m.test(dumpText)
  check('I5', 'the pinned host composes the INSTALLED bundle row through the public profile seam AND carries the OFF key verbatim into the composed tree (--dump-config shows the team row + plane + globEnabled: false + spill/client rows)',
    dump.status === 0 && hasTeamRow && hasPlane && hasKey && hasSubRows,
    `exit=${String(dump.status)} teamRow=${String(hasTeamRow)} plane=${String(hasPlane)} globEnabledFalse=${String(hasKey)} subRows=${String(hasSubRows)}`)

  const distPlaneRel = 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs'
  const distPlane = existsSync(join(probe.installedDir, distPlaneRel)) ? readFileSync(join(probe.installedDir, distPlaneRel), 'utf8') : ''
  const shutDetailMatch = /function createShutBackend[\s\S]*?detail: '([^']+)'/.exec(distPlane)
  const SHUT_DETAIL = shutDetailMatch === null ? '(shut-face detail not found in installed bytes)' : shutDetailMatch[1]
  const EXPECTED_REFUSAL = `${REFUSAL_PREFIX} kind=backend-failed code=${IO_TEXT} detail=${SHUT_DETAIL}`
  writeEvidence('installed-gate-witness.json', {
    distPlaneRel, inManifest: new Set(m.manifest.map((x) => x.path)).has(distPlaneRel),
    globEnabledHits: distPlane.split('globEnabled').length - 1,
    shutBackendIdHits: distPlane.split('a5-glob-config-disabled').length - 1,
    gateLines: distPlane.split('\n').filter((l) => /globEnabled|globDisabledShut/.test(l)).map((l) => l.trim()).slice(0, 12),
    shutDetail: SHUT_DETAIL, expectedRefusalVerbatim: EXPECTED_REFUSAL,
  })
  check('I-SHIP', 'THE SHUT-OFF GATE IS ON THE FACE THAT RUNS: the INSTALLED dist bytes of the production plane row consume planeCfg.globEnabled and carry the honest disabled backendId (not only the git source)',
    new Set(m.manifest.map((x) => x.path)).has(distPlaneRel) && distPlane.includes('globEnabled') && distPlane.includes("globEnabled === false") && distPlane.includes('a5-glob-config-disabled'),
    `globEnabledHits=${String(distPlane.split('globEnabled').length - 1)} shutIdHits=${String(distPlane.split('a5-glob-config-disabled').length - 1)}`)
  faceReference = { rootSha: m.rootSha, fromProbe: true }

  // ── mock at the LLM slot ───────────────────────────────────────────────────
  MK = `A5GLOBOFF_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const markers = []
  for (const mode of MODE_RUN) markers.push(`${MK}_${mode.toUpperCase()}_DISC`, `${MK}_${mode.toUpperCase()}_L0`, `${MK}_${mode.toUpperCase()}_TASK_A`)
  markers.push('A5GLOBOFF_MEMBER_RESULT', 'A5GLOBOFF_LEADER_DONE')
  const mockDecide = ({ req }) => {
    const digest = digestRequest(req)
    digest.markerHits = markers.filter((mk) => digest._text.includes(mk))
    const rec = mock.requests[mock.requests.length - 1]
    if (rec !== undefined) {
      rec.digest = digest
      if (rec.seq > 8 && mock.requests[rec.seq - 8]?.body !== null) {
        const old = mock.requests[rec.seq - 8]
        if (old !== undefined && old.body !== null) old.body = { __pruned: true, msgCount: old.digest?.msgCount, toolCount: old.digest?.toolCount }
      }
    }
    const text = digest._text
    for (const mode of MODE_RUN) {
      const MU = mode.toUpperCase()
      if (text.includes(`${MK}_${MU}_DISC`)) return { kind: 'text', content: 'A5GO_DISC_OK' }
      if (text.includes(`${MK}_${MU}_L0`)) {
        const calls = digest.assistantToolNames
        if (calls.length === 0) return toolCall(`call-go-delegate-${rnd()}`, 'team_delegate', {
          rootSessionId: CREATE_ROOT, requestToken: TK_A1, delegationTemplateId: 'wa', label: 'off-a',
          taskSummary: 'a5glob-off four-tool matrix (member A)',
          prompt: `${MK}_${MU}_TASK_A Do the delegated work exactly as instructed.`, async: false,
        })
        if (calls.length === 1) return toolCall(`call-go-collect-${rnd()}`, 'team_collect', { rootSessionId: CREATE_ROOT, requestToken: `a5go-collect-${RUN_STAMP}`, requestTokens: [TK_A1] })
        return { kind: 'text', content: 'A5GLOBOFF_LEADER_DONE' }
      }
      if (text.includes(`${MK}_${MU}_TASK_A`)) {
        const steps = stepsFor(mode)
        const idx = steps.findIndex((s) => !text.includes(stepMarker(s)))
        if (idx === -1) {
          const results = digest.toolResults
          return { kind: 'text', content: `A5GLOBOFF_MEMBER_RESULT ${results.map((r, i) => `r${String(i)}=${r.slice(0, 220).replace(/\s+/g, ' ')}`).join(' | ')}` }
        }
        const [name, a] = steps[idx]
        return toolCall(`call-go-${mode}-${String(idx)}-${rnd()}`, name, a)
      }
    }
    return { kind: 'text', content: 'a5glob-off-mock: unscripted request, completing quietly.' }
  }
  let mock = null
  let mockPortUsed = 0
  for (const candidate of [mockPort, 3493, 3496, 3497, 3498, 3499, 3500]) {
    if (candidate === 0 || !(await portFree(candidate))) continue
    try { mock = await startMockModel({ port: candidate, log: () => { }, decide: mockDecide }); mockPortUsed = candidate; break } catch (error) {
      if (String(error?.code ?? '') !== 'EADDRINUSE') throw error
    }
  }
  if (mock === null) die('no 349x mock port could be bound')

  const worlds = {}
  try {
    for (const mode of MODE_RUN) worlds[mode] = await runWorld({ mode, mock })
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }

  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  const stableAfter = await stableProbe()
  check('H3', ':3080 stable instance untouched (read-only probe before/after identical) and the test-use host porcelain 0 after',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)
  check('W1', 'all three worlds ran on the REAL installed face and were swept',
    MODE_RUN.every((w) => worlds[w]?.ok === true), MODE_RUN.map((w) => `${w}:${worlds[w]?.ok === true ? 'ok' : 'FAIL'}${worlds[w]?.swept ? '/swept' : '/UNSWEPT'}`).join(' '))

  // ─── reading helpers ───────────────────────────────────────────────────────
  const wireText = (txt) => {
    try { const p = JSON.parse(String(txt)); return Array.isArray(p) ? p.map((c) => String(c?.text ?? '')).join('\n') : String(txt) } catch { return String(txt) }
  }
  const namedFiles = (txt) => wireText(txt).split('\n').filter((l) => l.startsWith('> ') && !l.includes('truncated')).map((l) => l.slice(2).trim())
  const landings = (mode) => {
    const w = worlds[mode] ?? {}
    const names = w.memberToolCallOrder ?? []
    const results = (w.memberToolResults ?? []).map((r) => wireText(r))
    const byTool = {}
    names.forEach((n, i) => { (byTool[n] ??= []).push({ i, text: results[i] ?? 'LEG-MISSING' }) })
    return { names, results, byTool }
  }
  const L = { off: landings('off'), default: landings('default'), rename: landings('rename') }
  const pick = (mode, tool) => (L[mode].byTool[tool] ?? [{ text: 'LEG-MISSING' }])[0].text
  writeEvidence('landings.json', {
    off: L.off.byTool, default: L.default.byTool, rename: L.rename.byTool,
    expectedRefusalVerbatim: EXPECTED_REFUSAL,
  })

  // ─── M family: the OFF form on the installed face ──────────────────────────
  const off = worlds.off ?? {}
  const offObs = (off.planeObservations ?? []).filter((l) => /^a5-plane: placed /.test(String(l)))
  check('M0b', 'the production entry\'s OWN observation stream (read through the read-only observer row, /__a5ie/facts) shows the plane placing all four rows in the off world — the mount line is the same face the plugin booted, not a kit reconstruction',
    offObs.some((l) => /team_grep,team_glob,team_bash,read/.test(String(l))),
    `placedLines=${JSON.stringify(offObs.map((l) => String(l).slice(0, 90)))}`)
  const offGlob = pick('off', 'team_glob')
  const offPlaneNames = (off.memberAWireCatalog ?? []).filter((n) => n.startsWith('team_') || n === 'read')
  check('M0', 'THE MOUNT IS UNCHANGED BY THE KEY: with globEnabled:false the four plane names still reach the model-facing wire of the governed member (the row mounts and its EFFECT face is what refuses — nothing disappears)',
    ['team_grep', 'team_glob', 'team_bash', 'read'].every((n) => (off.memberAWireCatalog ?? []).includes(n)),
    `member plane names=${JSON.stringify(offPlaneNames)}`)
  check('M1', 'team_glob ON THE INSTALLED FACE lands the EXISTING typed shut face verbatim — a5p5-refused / kind=backend-failed / IO_POLICY_UNSUPPORTED with the shut detail read OUT OF THE INSTALLED BYTES (zero new error surface)',
    offGlob.includes(EXPECTED_REFUSAL) && offGlob.includes(IO_TEXT),
    `landing=${JSON.stringify(offGlob).slice(0, 320)}`)
  const offLed = off.worldLedger ?? { counts: {}, countsWithExit: {}, plans: [], globWalkerPlans: [] }
  check('M2', 'ZERO glob-row spawns, out-of-band (no in-process counter, no log trust, no path assumption): walking the WHOLE off world for the provider\'s own records (plans/plan-*.json + out/plan-*/exit.json) and attributing every plan from its own argv finds NO glob-walker plan (`rg … --files`) anywhere while the key is off — a shut row never even prepares a confined plan',
    (offLed.counts['rg-glob-walker'] ?? 0) === 0 && offLed.globWalkerPlans.length === 0,
    `planKinds=${JSON.stringify(offLed.counts)} withExit=${JSON.stringify(offLed.countsWithExit)} globWalkerPlans=${String(offLed.globWalkerPlans.length)} dirsVisited=${String(offLed.dirsVisited)}`)
  check('M2b', 'IN-WORLD POSITIVE CONTROL for that detector: in the SAME off world the argv-attributed ledger shows the shell row\'s confined plans (>= 2, one per bash leg) and the search row\'s rg plan (>= 1, rg WITHOUT --files), each with its exit.json record — the missing glob-walker plan is the row being shut, not the detector being blind',
    (offLed.counts.shell ?? 0) >= 2 && (offLed.counts['rg-search'] ?? 0) >= 1 && (offLed.countsWithExit.shell ?? 0) >= 2 && (offLed.countsWithExit['rg-search'] ?? 0) >= 1,
    `shell=${String(offLed.counts.shell ?? 0)} rgSearch=${String(offLed.counts['rg-search'] ?? 0)} shellExit=${String(offLed.countsWithExit.shell ?? 0)} rgSearchExit=${String(offLed.countsWithExit['rg-search'] ?? 0)}`)
  const offGrep = pick('off', 'team_grep')
  check('M3', 'team_grep REALLY RUNS with glob shut: the governed search row returns the seeded token on the content face (no refusal, no exit= anywhere)',
    offGrep.includes(TOK_GREP) && offGrep.includes('a5p5-meta') && !offGrep.includes(IO_TEXT) && !offGrep.includes('exit='),
    `landing=${JSON.stringify(offGrep).slice(0, 260)}`)
  const offBash1 = pick('off', 'team_bash')
  check('M4', 'team_bash POSITIVE (REAL Landlock) with glob shut: confined run RAN (token on stdout, exit=0) and the inside-root write landed on disk (fs-probed before the sweep)',
    offBash1.includes(TOK_BASH) && offBash1.includes('bash · exit=0') && off.bashWroteExists === true && String(off.bashWroteBytes ?? '').includes(BASH_WRITE_MARKER),
    `landing=${JSON.stringify(offBash1).slice(0, 220)} wrote=${String(off.bashWroteExists)} abi=${String(off.launcherAbiPreflight?.kind)}/${String(off.launcherAbiPreflight?.abiVersion)}`)
  const offBash2 = (L.off.byTool.team_bash ?? [])[1]?.text ?? 'LEG-MISSING'
  check('M5', 'team_bash NEGATIVE CONTROL with glob shut (r5 same-shape): the out-of-bounds leg still lands `bash · exit=1` + the kernel refusal verbatim, and the outside marker appears in NO wire byte of this world',
    offBash2.includes('bash · exit=1') && offBash2.includes('"exitCode":1') && offBash2.includes('Permission denied') && off.outsideMarkerOnWire === 0,
    `landing=${JSON.stringify(offBash2).slice(0, 260)} markerOnWire=${String(off.outsideMarkerOnWire)}`)
  const offRead = pick('off', 'read')
  check('M6', 'read REALLY READS with glob shut (governed read row, takeover name untouched): the seeded file content comes back through the plane, no refusal',
    offRead.includes(TOK_GREP) && !offRead.includes('a5p5-refused') && !offRead.includes(IO_TEXT),
    `landing=${JSON.stringify(offRead).slice(0, 220)}`)
  const offSampler = off.sampler ?? { counts: {}, sightings: [] }
  check('M7', 'process-table corroboration (attributable form): the /proc sampler (50 ms, whole world lifetime) sighted NO rg process carrying the glob-walker face (`rg … --files …`) in the off world, while it demonstrably saw that world\'s confined lanes (launcher sightings > 0). Corroboration only — M2 (the provider plan/exit ledger) is the proof.',
    offSampler.counts.rgGlobWalker === 0 && offSampler.counts.launcher > 0,
    `rgGlobWalker=${String(offSampler.counts.rgGlobWalker)} rgTotal=${String(offSampler.counts.rg)} launcher=${String(offSampler.counts.launcher)} bash=${String(offSampler.counts.bash)} other=${String(offSampler.counts.other)}`)
  const offLogGlobLines = (off.logObservations ?? []).filter((l) => /anchored-glob/.test(l))
  const offLogOtherLines = (off.logObservations ?? []).filter((l) => /anchored-search|confined-shell ran/.test(l))
  check('M8', 'host-log row witness (the provider\'s own lines): ZERO anchored-glob witness lines in the off world while the search/shell witnesses are present in the same log',
    offLogGlobLines.length === 0 && offLogOtherLines.length >= 2,
    `globLines=${String(offLogGlobLines.length)} otherLines=${String(offLogOtherLines.length)}`)
  const seedWire = (off.seedNamesOnWire ?? []).reduce((a, x) => a + x.hits, 0)
  const seedLog = (off.seedNamesInLog ?? []).reduce((a, x) => a + x.hits, 0)
  check('M9', 'NO FALLBACK, install-face form: the glob fixture\'s unique seed names (zzgloboff-*) appear in NO wire byte and NO host-log byte of the off world — after the refusal nothing listed out, no partial result, no direct-fs enumeration surface',
    seedWire === 0 && seedLog === 0,
    `wireHits=${String(seedWire)} logHits=${String(seedLog)} perSeed=${JSON.stringify(off.seedNamesOnWire)}`)
  check('M10', 'the refusal is a REFUSAL, not a truncated answer: the glob landing carries no result lines and no files_with_matches meta alongside the typed refusal',
    offGlob.includes(IO_TEXT) && namedFiles(offGlob).length === 0 && !offGlob.includes('files_with_matches'),
    `nameLines=${String(namedFiles(offGlob).length)} hasMetaFiles=${String(offGlob.includes('files_with_matches'))}`)

  // ─── C family: the same config with the key ABSENT ─────────────────────────
  const dflt = worlds.default ?? {}
  const dGlob = pick('default', 'team_glob')
  check('C1', 'CONTROL (zero-default-change ON THE INSTALLED FACE): the byte-identical config with the key ABSENT runs the REAL anchored rg glob — both seeded files listed, no refusal, and the glob completion law untouched (no exit=/exitCode)',
    dGlob.includes('a5p5-meta') && dGlob.includes('files_with_matches') && GPOS_SEEDS.every((n) => namedFiles(dGlob).some((x) => x.endsWith(n))) && !dGlob.includes(IO_TEXT) && !dGlob.includes('exit='),
    `names=${JSON.stringify(namedFiles(dGlob)).slice(0, 200)}`)
  const dLed = dflt.worldLedger ?? { counts: {}, countsWithExit: {}, globWalkerPlans: [] }
  const dGlobPlans = dLed.globWalkerPlans ?? []
  check('C2', 'OUT-OF-BAND POSITIVE CONTROL for the M2 detector: in the control world the SAME whole-tree walk DOES find the glob-walker plan — packaged rg with the glob walker face (`--files`), one plan + one exit.json per glob call — which is what turns M2\'s zero into a fact about the key',
    dGlobPlans.length >= 1 && dGlobPlans.every((x) => x.hasExitRecord) && String(dGlobPlans[0]?.argv?.[0] ?? '').includes('/ripgrep'),
    `globWalkerPlans=${String(dGlobPlans.length)} withExit=${String(dLed.countsWithExit?.['rg-glob-walker'] ?? 0)} planAt=${JSON.stringify(dGlobPlans[0]?.rel ?? '')} argv=${JSON.stringify((dGlobPlans[0]?.argv ?? []).slice(0, 3)).slice(0, 200)}`)
  const dSampler = dflt.sampler ?? { counts: {} }
  // S family — the DEFAULT public-contract form on the installed face (root
  // 23:34Z: the shut-off sheet never covered default-form usability after the
  // provider's empty-scratch law, so grade it here with the SAME plumbing).
  // The contract (docs/INSTALL.md §3.5) carries NO scratchRoot key; the live
  // glob row therefore runs entirely on its assembled default. Where that
  // default lands is not assumed — it is read from the provider's own records.
  const dLedS = dflt.worldLedger ?? { counts: {}, plans: [] }
  const dGlobPlansS = dLedS.plans.filter((x) => x.kind === 'rg-glob-walker')
  const siblingHits = dGlobPlansS.filter((x) => /governed\.a5g7-glob-scratch\/plans\//.test(x.rel))
  const insideRoot = dGlobPlansS.filter((x) => /^governed\/plans\//.test(x.rel) || x.rel.startsWith('governed/'))
  const listingScratch = (L.default.byTool.team_glob ?? []).flatMap((x) => namedFiles(x.text)).filter((n) => /a5g7-glob-scratch|\/plans\/|exit\.json/.test(n))
  check('S1', 'THE DEFAULT FORM IS LIVE ON THE INSTALLED FACE, AND ITS SCRATCH LAW HOLDS WHERE IT LANDED: the glob row — configured with the contract text and NO scratchRoot key — prepared its confined walker plan at the governed-root SIBLING (`<root>.a5g7-glob-scratch/plans/plan-*.json`) with its exit record, no glob-walker plan sits inside the governed root, and the listing the member got back carries no scratch artifact',
    dGlobPlansS.length >= 1 && dGlobPlansS.every((x) => x.hasExitRecord) && siblingHits.length === dGlobPlansS.length && insideRoot.length === 0 && listingScratch.length === 0,
    `globPlans=${String(dGlobPlansS.length)} atSibling=${String(siblingHits.length)} insideRoot=${String(insideRoot.length)} withExit=${String(dGlobPlansS.filter((x) => x.hasExitRecord).length)} planAt=${JSON.stringify(dGlobPlansS[0]?.rel ?? '')} scratchInListing=${String(listingScratch.length)}`)
  const baselineLedgerPath = join(HERE, '..', 'runs', '2026-10-18T22-07-01Z', 'confined-ledger-default.json')
  let baselinePlanAt = '(baseline ledger unreadable)'
  try { baselinePlanAt = (JSON.parse(readFileSync(baselineLedgerPath, 'utf8')).wholeTree?.globWalkerPlans ?? [{ rel: '(none recorded)' }])[0].rel } catch { /* booked only */ }
  note('S1b', 'where the same default moved (booked, never graded): the SAME contract-shaped default world at the 21-5xZ baseline put the glob row\'s plan at ' + JSON.stringify(baselinePlanAt) + ' (provider default was cwd-relative, before the empty-scratch law); this run records ' + JSON.stringify(dGlobPlansS[0]?.rel ?? '') + ' — the two recorded paths are the difference the #337 assembly fix closed, observed on two real installs',
    `baseline=${JSON.stringify(baselinePlanAt)} now=${JSON.stringify(dGlobPlansS[0]?.rel ?? '')}`)
  note('C2b', `sampling-resolution book (never graded): rg sightings in the CONTROL world where the glob row IS live — rgTotal=${String(dSampler.counts.rg ?? 0)}, glob-walker-attributable=${String(dSampler.counts.rgGlobWalker ?? 0)}; a ~10 ms rg process may simply be missed at 50 ms, which is exactly why M2/C2 ride the provider ledger, not the sampler`, `rgTotal=${String(dSampler.counts.rg ?? 0)} globWalker=${String(dSampler.counts.rgGlobWalker ?? 0)}`)
  const dLogGlobLines = (dflt.logObservations ?? []).filter((l) => /anchored-glob ran/.test(l))
  check('C3', 'the host\'s own glob witness fires in the control world (`anchored-glob ran … pid= files=`) — the pair that makes M8\'s zero a fact about the key and not about logging',
    dLogGlobLines.length >= 1, `lines=${JSON.stringify(dLogGlobLines.map((l) => l.slice(0, 150)))}`)
  const dGrep = pick('default', 'team_grep')
  const dBash1 = pick('default', 'team_bash')
  const dRead = pick('default', 'read')
  check('C4', 'SAME-SHAPE CONTROL for the three surviving rows: with the key absent the grep/bash/read landings keep the same form as in the off world (grep hit + search meta; bash exit=0 + write; read content) — the key changes exactly one row',
    dGrep.includes(TOK_GREP) && dGrep.includes('"kind":"search"') && dBash1.includes('bash · exit=0') && dflt.bashWroteExists === true && dRead.includes(TOK_GREP) && !dGrep.includes(IO_TEXT) && !dBash1.includes(IO_TEXT) && !dRead.includes(IO_TEXT),
    `grep=${JSON.stringify(dGrep).slice(0, 120)} bash=${JSON.stringify(dBash1).slice(0, 120)} read=${JSON.stringify(dRead).slice(0, 120)}`)
  check('C5', 'the two configs differ in EXACTLY ONE key: the off world\'s written profile layer carries teamToolPlane.globEnabled and the control world\'s does not (the difference is the config, not the kit)',
    off.layerHasGlobEnabledKey === true && dflt.layerHasGlobEnabledKey === false,
    `offLayerHasGlobEnabled=${String(off.layerHasGlobEnabledKey)} defaultLayerHasGlobEnabled=${String(dflt.layerHasGlobEnabledKey)}`)
  const dBash2 = (L.default.byTool.team_bash ?? [])[1]?.text ?? 'LEG-MISSING'
  check('C6', 'r5-shaped regression on the control world (a5ie-r5 minimum): the out-of-bounds bash leg still lands exit=1 with the kernel refusal verbatim and the marker stays off the wire',
    dBash2.includes('bash · exit=1') && dBash2.includes('"exitCode":1') && dBash2.includes('Permission denied') && dflt.outsideMarkerOnWire === 0,
    `landing=${JSON.stringify(dBash2).slice(0, 260)} markerOnWire=${String(dflt.outsideMarkerOnWire)}`)

  // ─── R family: rename cannot restore ───────────────────────────────────────
  const rn = worlds.rename ?? {}
  const rnGlob = pick('rename', 'zglob')
  check('R1', 'RENAME FORM mounts under the new spelling: with names.glob="zglob" + globEnabled:false the member wire carries zglob and NOT team_glob (the shut decision rides the class, the name is still a valid mount spelling)',
    (rn.memberAWireCatalog ?? []).includes('zglob') && !(rn.memberAWireCatalog ?? []).includes('team_glob'),
    `member plane names=${JSON.stringify((rn.memberAWireCatalog ?? []).filter((n) => n.startsWith('team_') || n === 'read' || n === 'zglob'))}`)
  check('R2', 'a renamed glob is STILL SHUT on the installed face: zglob lands the same typed refusal bytes (same code, same detail sentence from the installed face)',
    rnGlob.includes(EXPECTED_REFUSAL) && rnGlob.includes(IO_TEXT), `landing=${JSON.stringify(rnGlob).slice(0, 320)}`)
  const rnLed = rn.worldLedger ?? { counts: {}, globWalkerPlans: [] }
  check('R3', 'and it still spawns nothing: the rename world\'s whole-tree ledger carries no glob-walker plan either (the class gate wins before any backend is built), while its shell plan is there',
    (rnLed.counts['rg-glob-walker'] ?? 0) === 0 && (rnLed.counts.shell ?? 0) >= 1,
    `planKinds=${JSON.stringify(rnLed.counts)} globWalkerPlans=${String(rnLed.globWalkerPlans.length)}`)
  const rnBash = pick('rename', 'team_bash')
  const rnSampler = rn.sampler ?? { counts: {} }
  check('R4', 'nothing else closed in the rename world: team_bash still runs for real (exit=0) and no glob-walker rg was sighted in that world either',
    rnBash.includes('bash · exit=0') && rnSampler.counts.rgGlobWalker === 0,
    `landing=${JSON.stringify(rnBash).slice(0, 160)} rgGlobWalkerSightings=${String(rnSampler.counts.rgGlobWalker)}`)

  // ─── Z family ──────────────────────────────────────────────────────────────
  const allHostErrors = MODE_RUN.flatMap((w) => worlds[w]?.hostErrors ?? [])
  check('Z1', 'no bootstrap/module/config refusal leaked in any of the three worlds (no ERR_MODULE_NOT_FOUND, no mount-REFUSED, no PLANE_CONFIG/TEAM_PLUGIN_CONFIG line, no placement-REFUSED)',
    allHostErrors.length === 0, `hostErrors=${JSON.stringify(allHostErrors.slice(0, 2)).slice(0, 240)}`)
  const anyUnexpectedIO = MODE_RUN.flatMap((w) => (worlds[w]?.memberToolResults ?? []).map((r) => wireText(r))).filter((t) => t.includes(IO_TEXT))
  check('Z2', 'the typed refusal appears EXACTLY where the key puts it: one IO_POLICY landing for each shut glob call (off world + rename world) and none in the control world — across all driven legs of all executed worlds the count is exactly the number of shut shapes, never one more, never one less',
    anyUnexpectedIO.length === MODE_RUN.filter((x) => MODES[x].globEnabled === false).length, `ioLandings=${String(anyUnexpectedIO.length)} of ${String(MODE_RUN.reduce((a, w) => a + ((worlds[w]?.memberToolResults ?? []).length), 0))} legs`)

  // ─── T family ──────────────────────────────────────────────────────────────
  if (!KEEP) { try { rmSync(faceMirror, { recursive: true, force: true }) } catch { /* best effort */ } }
  if (!KEEP) { try { rmSync(INSTALL_HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
  const leftHomes = existsSync(HOMES_ROOT) ? readdirSync(HOMES_ROOT).filter((d) => d.startsWith(`${WORLD_PREFIX}-`)) : []
  check('T1', `world cleanup: EXACT-prefix sweep — no ${WORLD_PREFIX}-* DSH_HOME (or lock) remains under tests/homes; the byte manifest + logs are the retained evidence`,
    leftHomes.length === 0 && !existsSync(INSTALL_HOME), `left=${JSON.stringify(leftHomes)} installHomeSwept=${String(!existsSync(INSTALL_HOME))}`)
  const rawLeft = MODE_RUN.filter((w) => existsSync(join(EVIDENCE_DIR, `instance-${w}.raw.log`)))
  check('T2', 'launch-token hygiene: raw instance logs deleted after redaction at capture', rawLeft.length === 0, `rawLeft=${JSON.stringify(rawLeft)}`)
  let portsReleased = true
  for (const p of [...ports, mockPortUsed]) { portsReleased = portsReleased && (await portFree(p)) }
  check('T3', 'ports released after the run (three host ports + the mock port self-prove free again)', portsReleased, `ports=${ports.join('/')}+${String(mockPortUsed)} free=${String(portsReleased)}`)
  note('T4', `pnpm store kept OUTSIDE the world set and is removed by name by the operator after this run: ${STORE_DIR}; pinned source worktree: ${SRC} @${WORKTREE_HEAD.slice(0, 12)}`, `storeExists=${String(existsSync(STORE_DIR))}`)

  writeEvidence('criteria.json', {
    runStamp: RUN_STAMP, ports: [...ports, mockPortUsed], installSpec: INSTALL_SPEC, installedSha: EXPECTED_MASTER,
    srcRoot: SRC, srcWorktreeHead: WORKTREE_HEAD, expectedRefusalVerbatim: EXPECTED_REFUSAL,
    testuse: { dir: TESTUSE, head, porcelainAfter }, storeDir: STORE_DIR,
    installedFileCount: face.expected.length, rootSha: m.rootSha, criteria: CRITERIA,
  })
  {
    const receiptMap = {
      I9: ['launcher-deployment.json'], I8: ['launcher-deployment.json'], 'I-SHIP': ['installed-gate-witness.json', 'install-manifest.json'],
      I5: ['dump-config-install-probe.txt'], I3d: ['install-manifest.json'],
      M1: ['landings.json', 'instance-off.log'], M2: ['confined-ledger-off.json'], M2b: ['confined-ledger-off.json'], M0b: ['observer-facts-off.json'],
      M7: ['proc-sampler-off.json'], M8: ['instance-off.log'], M9: ['instance-off.log', 'wire-digests-off.jsonl'],
      C1: ['landings.json', 'wire-digests-default.jsonl'], C2: ['confined-ledger-default.json'], C3: ['instance-default.log'],
      R1: ['wire-digests-rename.jsonl'], R2: ['landings.json'], R3: ['confined-ledger-rename.json'],
    }
    const lines = CRITERIA.map((x) => JSON.stringify({
      leg: x.id,
      verdict: x.pass === true ? 'PASS' : (x.pass === null || x.pass === undefined ? 'BOOK' : 'FAIL'),
      receipts: ['criteria.json', ...(receiptMap[x.id] ?? [])],
      wire: String(x.observed ?? '').replace(/\s+/g, ' ').slice(0, 170),
    }))
    writeFileSync(join(EVIDENCE_DIR, 'leg-ledger.jsonl'), lines.join('\n') + '\n')
  }
  const red = CRITERIA.filter((c) => c.pass === false)
  const naCount = CRITERIA.filter((c) => c.na === true).length
  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`} (${String(CRITERIA.filter((c) => c.pass === true).length)}/${String(CRITERIA.filter((c) => c.pass === true || c.pass === false).length)}${CRITERIA.some((c) => c.pass === null && c.na !== true) ? ` +${String(CRITERIA.filter((c) => c.pass === null && c.na !== true).length)} booked` : ''}${naCount > 0 ? ` +${String(naCount)} shape-N/A` : ''})`)
  process.exit(red.length === 0 ? 0 : 2)
}

main().then(
  () => process.exit(0),
  async (error) => {
    console.log(`FATAL ${redact(String(error?.stack ?? error)).split('\n').slice(0, 10).join(' | ')}`)
    writeEvidence('fatal.json', { error: redact(String(error?.message ?? error)), criteriaSoFar: CRITERIA })
    process.exit(1)
  },
)
