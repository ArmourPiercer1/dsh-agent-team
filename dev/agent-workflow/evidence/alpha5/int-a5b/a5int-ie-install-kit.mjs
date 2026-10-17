#!/usr/bin/env node
/**
 * a5int-ie-install-kit.mjs — INSTALL-ENTRY acceptance kit (alpha5).
 *
 * ROOT MANDATE: acceptance = a REAL governed-Team call driven from the
 * INSTALLABLE ARTIFACT, not from a lane kit. Four phases, one runner:
 *
 *  PHASE E (pure install-surface self-proof):
 *    EXP = a FRESH directory. `git archive HEAD packages/runtime/dist
 *    packages/runtime/package.json | tar -x` — the committed install surface
 *    unfolded byte-exact (this IS the committed manifest unfolding; no repo
 *    source path is ever a load target). The dependency closure (the npm deps
 *    packages/runtime/package.json DECLARES) is landed into EXP/node_modules
 *    from the pinned 0.2.0-rc.2 pnpm store (a real install would fetch them;
 *    offline here, disclosed). Then: import probes of the production rows
 *    FROM EXP ONLY + an ancestor-shadow scan proving no ancestor
 *    node_modules supplies anything the load graph needs.
 *
 *  PHASE S (synth, rows loaded FROM EXP): the plane mount + the PR7 jobs row
 *    lease lifecycle (ACTIVE→DRAINING→RELEASED) on synthetic domains —
 *    the lifecycle that closes behind close() at teardown, measured on the
 *    installed module itself.
 *
 *  WORLDS (four sequential boots, ONE port 3183, the EXPANSION is the plugin
 *  load path; :3080 read-only 401-probe before/after):
 *    team     — governed preset team on the EXP row: Leader→member REAL
 *               delegation (team_delegate sync + team_collect), the member's
 *               REAL own-layer trio calls through the R1 placement
 *               (team_bash → lane-denied BEFORE backend; team_grep →
 *               lane-allowed → effect face → typed IO_POLICY_UNSUPPORTED —
 *               the installed surface answers with its name, never faked),
 *               the member's final result carried back INTO the Leader's
 *               wire transcript; full ledger (wire catalogs every request,
 *               turn completion, lease witness pre-close + graceful exit).
 *    baseline — SAME row WITHOUT teamToolPlane: the control-of-controls
 *               (zero plane anywhere) + the A/B face for the non-team Δ=[].
 *    gatered  — plane mounted AND a team_-namespace masquerader on the
 *               governed surface: the Coverage Gate keeps its red.
 *    refuse   — half-paired trustRoot row: the pairing law refuses the
 *               governed setup with TRUST_ROOT_SHA_MISMATCH, nothing mounts.
 *
 *  ③ NON-TEAM ZERO-EXPANSION (same round): standard+minimal sessions in the
 *    SAME boots — registry face AND wire face: Δ(baseline→team)=[] on both,
 *    and zero team_ alias names on either face, measured in THIS run.
 *
 * Honesty: launch tokens redacted AT capture; worlds swept; the expansion is
 * swept at the end (its file manifest is the evidence). Effect-face bodies
 * stay typed-refused on the installed surface (GLUE-5 disclosure 4) — this
 * kit measures the CHAIN depth the installed artifact really runs.
 *
 * @module evidence/alpha5/install-entry/a5int-ie-install-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, testUseTree, homeDir } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const TESTUSE = resolve(argValue('testuse', testUseTree(WORKTREE)))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DEPS_SRC = resolve(argValue('deps-src', join(WORKTREE, '..', 'a5-glue5-entry', 'packages', 'runtime', 'node_modules')))
const DEPS_STORE = resolve(argValue('deps-store', join(WORKTREE, '..', 'a5-glue5-entry', 'node_modules', '.pnpm')))
const EXP = resolve(argValue('expansion', join(WORKTREE, '..', '.a5int-ie-expansion', RUN_STAMP)))
const DIST_REL = join('packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(EXP, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href
const OBSERVER_ROW_NAME = pathToFileURL(join(HERE, 'a5int-ie-observer-row.mjs')).href
const STRAY_ROW_NAME = pathToFileURL(join(HERE, 'a5int-ie-stray-row.mjs')).href
const WORLD_PREFIX = 'a5int-ie'
const PRESET_ID = 'a5int-ie-base'
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const ALIASES = ['team_grep', 'team_glob', 'team_bash']
const PRESETS = ['standard', 'minimal']
const ALL_MODES = ['team', 'baseline', 'gatered', 'refuse']
const MODES = argValue('modes', ALL_MODES.join(',')).split(',').map((m) => m.trim()).filter((m) => ALL_MODES.includes(m))
const ROOT = `session-a5int-ie-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5int-ie-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5ie.anchor'
const BP_MAIN_ID = 'team.a5ie.main'
const TK_DELG = `a5int-ie-delg-${RUN_STAMP}`

// ── redaction at capture ─────────────────────────────────────────────────────
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${hex8(tok)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)

const CRITERIA = []
function check(id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${redact(String(observed)).slice(0, 300)}]`}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
function writeEvidence(name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
function portFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })
}
async function portFreeWait(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port)) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, 300))
  }
}
function gitAt(dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: redact(text).slice(0, 800) } }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function waitQuiet(deadlineMs, fn) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function waitForLogLine(logPath, regex, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not yet */ }
    const line = text.split('\n').find((l) => regex.test(l))
    if (line !== undefined) return line.slice(0, 400)
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 300))
  }
}
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
function walkFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else out.push(p.slice(base.length + 1))
  }
  return out
}

// ═══════════════════════ PHASE E — INSTALL-SURFACE UNFOLDING ════════════════
function phaseE() {
  const facts = { runStamp: RUN_STAMP, head: gitAt(WORKTREE, 'rev-parse', 'HEAD'), exp: EXP }
  // E1 — unfold the committed install surface byte-exact into a FRESH dir.
  // INSTALL MANIFEST (measured at boot, recorded as a FINDING): the dist
  // mirror is NOT self-contained — the production entry registers its
  // module-hook and storage seam from TWO tracked SIBLING files outside the
  // mirror (host.js candidates resolve to <pkg-root>/src/plugin/upstream-
  // resolver.mjs and <pkg-root>/root-binding/harness/seam.mjs; a pure-dist
  // expansion fails bootstrap with ERR_MODULE_NOT_FOUND). The committed
  // install set therefore = dist mirror + package.json + those two tracked
  // files + the tracked bundled skills dir (else "bundled team skills are
  // NOT registered (install-surface anomaly)"). Unfolding ALL of it is the
  // byte-exact expansion of the committed artifact set — nothing is built,
  // no repo path is a load target.
  if (existsSync(EXP)) rmSync(EXP, { recursive: true, force: true })
  mkdirSync(EXP, { recursive: true })
  const SIBLING_FILES = ['packages/runtime/src/plugin/upstream-resolver.mjs', 'packages/runtime/root-binding/harness/seam.mjs']
  const arch = spawnSync('git', ['-C', WORKTREE, 'archive', 'HEAD', '--', 'packages/runtime/dist', 'packages/runtime/package.json', ...SIBLING_FILES, '.agents/skills'], { maxBuffer: 512 * 1024 * 1024 })
  if (arch.status !== 0) die(`git archive failed: ${String(arch.stderr).slice(0, 200)}`)
  const tar = spawnSync('tar', ['-x', '-C', EXP], { input: arch.stdout })
  if (tar.status !== 0) die(`tar expand failed: ${String(tar.stderr).slice(0, 200)}`)
  const rel = walkFiles(EXP).sort()
  facts.fileCount = rel.length
  facts.siblingFiles = SIBLING_FILES.map((p) => ({ path: p, present: existsSync(join(EXP, p)), sha256: existsSync(join(EXP, p)) ? sha256File(join(EXP, p)) : null }))
  facts.bundledSkills = rel.filter((r) => r.replace(/\\/g, '/').startsWith('.agents/skills/')).map((r) => r.replace(/\\/g, '/'))
  facts.a5p5Files = rel.filter((r) => r.replace(/\\/g, '/').includes('packages/tools/a5p5-tools/')).length
  facts.gluePlacements = ['agent-bindings.mjs', 'team-tool-plane.mjs', 'jobs-gateway-assembly.mjs'].map((n) => {
    const p = join(EXP, DIST_REL, 'src', 'plugin', 'live', n)
    return { file: n, present: existsSync(p), sha256: existsSync(p) ? sha256File(p) : null }
  })
  facts.keyEntries = {
    host: existsSync(join(EXP, DIST_REL, 'src', 'plugin', 'host.js')),
    a5p5Register: existsSync(join(EXP, 'packages', 'runtime', 'dist', 'packages', 'tools', 'a5p5-tools', 'src', 'register.js')),
    a5p5Index: existsSync(join(EXP, 'packages', 'runtime', 'dist', 'packages', 'tools', 'a5p5-tools', 'src', 'index.js')),
    packageJson: existsSync(join(EXP, 'packages', 'runtime', 'package.json')),
  }
  facts.manifest = rel.map((r) => ({ path: r.replace(/\\/g, '/'), sha256: sha256File(join(EXP, r)) }))
  writeEvidence('expansion-manifest.json', { head: facts.head, fileCount: facts.fileCount, a5p5Files: facts.a5p5Files, gluePlacements: facts.gluePlacements, keyEntries: facts.keyEntries, siblingFiles: facts.siblingFiles, bundledSkills: facts.bundledSkills, manifest: facts.manifest })
  check('E1', 'unfolded (AUX surface, NON-PURE — the purity claim lives in RED-A): git archive HEAD = dist mirror (1727) + package.json + the TWO tracked sibling files the entry loads at runtime OUTSIDE the mirror (upstream-resolver.mjs hook, harness seam.mjs) + bundled skills. The public manifest (package.json files:["dist"]) does NOT cover the siblings; they are added here ONLY so governance legs ②③④ can run — per the root ruling a backfilled surface is never called a pure install pass; the gap itself is pinned by RED-A. Face: 44-file a5p5, 3 glue placements, entry rows; per-file sha256 in expansion-manifest.json',
    facts.fileCount === 1732 && facts.a5p5Files === 44 && facts.gluePlacements.every((g) => g.present) && facts.keyEntries.host && facts.keyEntries.a5p5Register && facts.keyEntries.packageJson
      && facts.siblingFiles.every((s) => s.present) && facts.bundledSkills.length >= 2,
    `files=${facts.fileCount} a5p5=${facts.a5p5Files} glue=${JSON.stringify(facts.gluePlacements.map((g) => g.present))} siblings=${JSON.stringify(facts.siblingFiles.map((s) => s.present))} skills=${facts.bundledSkills.length}`)

  // E2 — the committed-surface drift gate, run on THIS tree.
  const gate = spawnSync(process.execPath, [join(WORKTREE, 'scripts', 'check-artifacts-committed.mjs')], { cwd: WORKTREE, encoding: 'utf8', timeout: 180_000 })
  const gateOut = `${gate.stdout ?? ''}${gate.stderr ?? ''}`
  facts.driftGate = { status: gate.status, tail: gateOut.split('\n').filter((l) => /drift|OK|FAIL/i.test(l)).slice(-3) }
  check('E2', 'the repo drift gate (check-artifacts-committed) grades the committed dist at HEAD: exit 0 and drift=0',
    gate.status === 0 && /drift\s*[:=]\s*0|OK: /i.test(gateOut), `status=${String(gate.status)} tail=${JSON.stringify(facts.driftGate.tail)}`)

  // E3 — dependency closure: the npm deps the package DECLARES, TRANSITIVELY,
  // landed beside the unfolded artifact (a real install would fetch them;
  // here from the pinned 0.2.0-rc.2 tree: the sibling runtime's resolved
  // node_modules first, then the pnpm store — dereferenced, disclosed).
  const nm = join(EXP, 'node_modules')
  mkdirSync(nm, { recursive: true })
  const pkgJson = JSON.parse(readFileSync(join(EXP, 'packages', 'runtime', 'package.json'), 'utf8'))
  const declared = Object.keys(pkgJson.dependencies ?? {})
  const storeDirs = existsSync(DEPS_STORE) ? readdirSync(DEPS_STORE) : []
  const findSource = (name) => {
    const direct = join(DEPS_SRC, ...name.split('/'))
    if (existsSync(direct)) return { dir: direct, from: 'runtime-node-modules' }
    const flat = name.replace('/', '+')
    const plain = name.startsWith('@') ? name.split('/')[1] ?? name : name
    const cands = storeDirs
      .filter((d) => d.startsWith(`${flat}@`) || d.startsWith(`${plain}@`) || d.includes(`+${plain}@`))
      .sort((x, y) => (Number(y.startsWith(`${flat}@`)) - Number(x.startsWith(`${flat}@`))) || (Number(y.startsWith(`${plain}@`)) - Number(x.startsWith(`${plain}@`))) || x.localeCompare(y))
    const withInner = cands.find((d) => existsSync(join(DEPS_STORE, d, 'node_modules', name)))
    return withInner === undefined ? null : { dir: join(DEPS_STORE, withInner, 'node_modules', name), from: `pnpm-store:${withInner}` }
  }
  facts.closureBfs = []
  {
    const queue = [...declared]
    const seen = new Set()
    for (let guard = 0; guard < 240 && queue.length > 0; guard += 1) {
      const name = queue.shift()
      if (seen.has(name)) continue
      seen.add(name)
      const src = findSource(name)
      if (src === null) { facts.closureMiss = `no source for ${name}`; break }
      const dst = join(nm, ...name.split('/'))
      mkdirSync(dirname(dst), { recursive: true })
      const cp = spawnSync('cp', ['-aL', src.dir, dst], { timeout: 120_000 })
      if (cp.status !== 0) { facts.closureMiss = `cp -aL ${name}: ${String(cp.stderr).slice(0, 120)}`; break }
      facts.closureBfs.push({ pkg: name, from: src.from })
      const pjPath = join(dst, 'package.json')
      if (existsSync(pjPath)) {
        try { for (const dep of Object.keys(JSON.parse(readFileSync(pjPath, 'utf8')).dependencies ?? {})) if (!seen.has(dep)) queue.push(dep) } catch { /* malformed: the probe will fail loudly */ }
      }
    }
  }
  // Probe loop (safety net): import the production rows from EXP; every
  // MODULE_NOT_FOUND pulls that package from the pinned tree and retries.
  const probeRows = [
    join(EXP, DIST_REL, 'src', 'plugin', 'live', 'team-tool-plane.mjs'),
    join(EXP, DIST_REL, 'src', 'plugin', 'live', 'jobs-gateway-assembly.mjs'),
    join(EXP, DIST_REL, 'src', 'plugin', 'live', 'agent-bindings.mjs'),
    join(EXP, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs'),
    join(EXP, 'packages', 'runtime', 'dist', 'packages', 'tools', 'a5p5-tools', 'src', 'register.js'),
    join(EXP, DIST_REL, 'src', 'plugin', 'host.js'),
  ]
  facts.probeAttempts = []
  facts.closureAddedFromStore = []
  let probeOk = false
  for (let attempt = 0; attempt < 48 && !probeOk; attempt += 1) {
    const probe = spawnSync(process.execPath, ['-e', `
const rows = ${JSON.stringify(probeRows.map((p) => pathToFileURL(p).href))}
const missing = []
let hard = null
for (const r of rows) {
  try { await import(r) } catch (error) {
    const m = /Cannot find (?:package|module) '([^']+)'/.exec(String(error?.message ?? error))
    if (m !== null) { const pkg = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0]; if (!missing.includes(pkg)) missing.push(pkg); continue }
    hard = String(error?.message ?? error).slice(0, 300); break
  }
}
if (hard !== null) { console.log('HARD ' + hard); process.exit(2) }
if (missing.length > 0) { console.log('MISSING ' + missing.join(',')); process.exit(3) }
console.log('OK')
`], { encoding: 'utf8', timeout: 120_000 })
    const out = `${probe.stdout ?? ''}`.trim()
    facts.probeAttempts.push({ attempt, status: probe.status, out: out.slice(0, 300) })
    if (out.startsWith('OK')) { probeOk = true; break }
    if (!out.startsWith('MISSING')) break
    let dead = false
    for (const miss of out.slice(8).split(',').filter((s) => s !== '')) {
      const plain = miss.startsWith('@') ? miss.split('/')[1] ?? miss : miss
      const flat = miss.replace('/', '+')
      const cands = storeDirs
        .filter((d) => d.startsWith(`${flat}@`) || d.startsWith(`${plain}@`) || d.includes(`+${plain}@`))
        .sort((x, y) => (Number(y.startsWith(`${flat}@`)) - Number(x.startsWith(`${flat}@`))) || (Number(y.startsWith(`${plain}@`)) - Number(x.startsWith(`${plain}@`))) || x.localeCompare(y))
      if (cands.length === 0) { facts.closureMiss = `store miss for ${miss}`; dead = true; break }
      const withInner = cands.find((d) => existsSync(join(DEPS_STORE, d, 'node_modules', miss)))
      if (withInner === undefined) { facts.closureMiss = `store inner miss for ${miss}`; dead = true; break }
      const inner = join(DEPS_STORE, withInner, 'node_modules', miss)
      const dst = join(nm, ...miss.split('/'))
      spawnSync('rm', ['-rf', dst])
      mkdirSync(dirname(dst), { recursive: true })
      const cp = spawnSync('cp', ['-aL', inner, dst], { timeout: 120_000 })
      if (cp.status !== 0) { facts.closureMiss = `cp store ${miss}`; dead = true; break }
      facts.closureAddedFromStore.push({ pkg: miss, from: withInner })
    }
    if (dead) break
  }
  facts.nodeModulesTop = existsSync(nm) ? readdirSync(nm).filter((n) => !n.startsWith('.')) : []
  check('E3', 'import probe FROM THE EXPANSION ONLY: six production loads (host.js + the two live rows + the glue-edited bindings + the boot-time harness seam + the a5p5 register face) import clean with the TRANSITIVE dependency closure (declared deps BFS-complete) landed at EXP/node_modules — zero repo-source path in the load graph',
    probeOk === true && facts.closureMiss === undefined, `attempts=${facts.probeAttempts.length} bfs=${(facts.closureBfs ?? []).length} nmTop=${JSON.stringify(facts.nodeModulesTop).slice(0, 200)}${facts.closureMiss === undefined ? '' : ` miss=${facts.closureMiss}`}`)

  // E4 — Purity, measured: a module.resolve hook (node:module registerHooks)
  // enumerates EVERY file: module the production rows actually load. The
  // claim is not statistical: the observed load graph must be inside the
  // expansion, byte for byte. (The ancestor node_modules census is recorded
  // as context only — nearest-first resolution makes it unreachable anyway;
  // the hook settles what was ACTUALLY used.)
  const EXP_URL = pathToFileURL(EXP + '/').href
  const hookProbe = spawnSync(process.execPath, ['-e', `
import { registerHooks } from 'node:module'
const EXP = ${JSON.stringify(EXP_URL)}
const foreign = []
let loaded = 0
registerHooks({
  resolve(specifier, context, nextResolve) {
    const r = nextResolve(specifier, context)
    const url = (r !== null && typeof r === 'object' && typeof r.url === 'string') ? r.url : (typeof r === 'string' ? r : undefined)
    if (url !== undefined && url.startsWith('file:')) {
      loaded += 1
      if (!url.startsWith(EXP)) foreign.push({ specifier, url })
    }
    return r
  },
})
const rows = ${JSON.stringify(probeRows.map((p) => pathToFileURL(p).href))}
for (const r of rows) await import(r)
console.log(JSON.stringify({ loaded, foreign: foreign.slice(0, 20), foreignCount: foreign.length }))
`], { encoding: 'utf8', timeout: 120_000 })
  let hookFacts = { parseError: String(hookProbe.stderr ?? '').slice(0, 300) }
  try { hookFacts = JSON.parse(String(hookProbe.stdout ?? '').trim()) } catch { /* keep parseError */ }
  facts.loadGraph = hookFacts
  const census = []
  let anc = dirname(EXP)
  for (let i = 0; i < 8; i += 1) {
    const nmDir = join(anc, 'node_modules')
    if (existsSync(nmDir)) census.push({ dir: nmDir, topLevelNames: readdirSync(nmDir).length })
    anc = dirname(anc)
  }
  facts.ancestorNodeModulesCensus = census
  writeEvidence('install-surface-facts.json', facts)
  check('E4', 'purity MEASURED: a module.resolve hook over the probe run enumerates the ENTIRE load graph — every file: module the five production rows load resolves INSIDE the expansion (foreign modules: 0); the ancestor node_modules census is recorded as context',
    hookFacts.foreignCount === 0 && hookFacts.loaded > 50, `loaded=${String(hookFacts.loaded)} foreign=${String(hookFacts.foreignCount)} sample=${JSON.stringify(hookFacts.foreign ?? hookFacts.parseError).slice(0, 200)}`)
  return facts
}

// ════════ RED-A — STRICT public-manifest install face: the pinned RED ═══════
// The root rule: unfold ONLY what the public install manifest covers —
// package.json files:["dist"] + the declared dependency closure. The entry's
// runtime loads of <pkg-root>/src/plugin/upstream-resolver.mjs and
// <pkg-root>/root-binding/harness/seam.mjs are NOT covered → this boot MUST
// fail, and the failure (reference name + verbatim resolution error) is the
// pinned evidence. Packaging/path fixes belong to the GLUE formal round with a
// single writer — this kit changes no packaging and never calls a backfilled
// surface pure.
async function phaseE5RedA() {
  const PURE = EXP + '-pure'
  const HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-red-a-${RUN_STAMP}`)
  const RAW = join(EVIDENCE_DIR, 'red-a-instance.raw.log')
  const facts = { pure: PURE, home: HOME }
  let host = null
  try {
    rmSync(PURE, { recursive: true, force: true })
    mkdirSync(PURE, { recursive: true })
    const arch = spawnSync('git', ['-C', WORKTREE, 'archive', 'HEAD', '--', 'packages/runtime/dist', 'packages/runtime/package.json'], { maxBuffer: 512 * 1024 * 1024 })
    if (arch.status !== 0) die(`RED-A git archive failed: ${String(arch.stderr).slice(0, 160)}`)
    const tar = spawnSync('tar', ['-x', '-C', PURE], { input: arch.stdout })
    if (tar.status !== 0) die(`RED-A tar failed: ${String(tar.stderr).slice(0, 160)}`)
    facts.pureFileCount = walkFiles(PURE).length
    // a real install fetches the DECLARED dependency closure too — same one
    // the aux surface uses (single copy, disclosed).
    const cp = spawnSync('cp', ['-a', join(EXP, 'node_modules'), join(PURE, 'node_modules')], { timeout: 300_000 })
    if (cp.status !== 0) die(`RED-A deps copy failed: ${String(cp.stderr).slice(0, 160)}`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
    const bpDir = join(EVIDENCE_DIR, 'blueprints', 'red-a')
    mkdirSync(bpDir, { recursive: true })
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run bash commands.',
    })
    const patch = [
      '# RED-A: strict public-manifest install face (dist + declared deps ONLY).',
      '- insert:',
      ...yamlEmitItem({ id: 'dsh-agent-team', name: pathToFileURL(join(PURE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href, config: rowConfig('team', bpDir) }, 2),
      ...yamlEmitItem(presetDeclarationRow({ id: PRESET_ID, displayName: 'a5ie base', description: 'RED-A preset', plugins: basePlugins }), 2),
      '',
    ]
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patch.join('\n'))
    if (!(await portFreeWait(HOST_PORT))) die('port not free for RED-A')
    const outFd = openSync(RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: join(HOME, 'workspace'),
      stdio: ['ignore', outFd, outFd],
      env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: 'http://127.0.0.1:1', DEEPSEEK_API_KEY: 'red-a-none' },
    })
    host.on('exit', (code, signal) => { facts.hostExit = { code, signal } })
    const failLine = await waitForLogLine(RAW, /upstream-resolver\.mjs|ERR_MODULE_NOT_FOUND/, 120_000)
    facts.failLine = failLine === null ? null : redact(failLine)
    const fullText = (() => { try { return redact(readFileSync(RAW, 'utf8')) } catch { return '' } })()
    facts.failureBlock = fullText.split('\n').filter((l) => /upstream-resolver|ERR_MODULE_NOT_FOUND|bootstrap FAILED|Cannot find (?:package|module)/i.test(l)).slice(0, 8)
    check('RED-A', 'STRICT public-manifest install face (files:["dist"] + declared deps, NOTHING backfilled from the source tree): the production entry FAILS to boot — the entry\'s runtime reference to <pkg-root>/src/plugin/upstream-resolver.mjs (and the harness seam behind it) is a REAL install-manifest gap; the reference name + verbatim resolution failure are pinned here; packaging/path fix = GLUE formal round, single writer (this kit changes no packaging)',
      failLine !== null && /upstream-resolver\.mjs|ERR_MODULE_NOT_FOUND/.test(facts.failureBlock.join('\n')),
      `pureFiles=${String(facts.pureFileCount)} failLine=${String(facts.failLine ?? 'NONE(sees bootstrap)').slice(0, 200)}`)
    return facts
  } finally {
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 2000))
    try { writeFileSync(join(EVIDENCE_DIR, 'install-manifest-red-evidence.log'), redact(readFileSync(RAW, 'utf8'))); rmSync(RAW) } catch { /* none */ }
    try { rmSync(HOME, { recursive: true, force: true }); rmSync(PURE, { recursive: true, force: true }) } catch { /* best effort */ }
    writeEvidence('red-a-facts.json', facts)
  }
}

// ═══════════════════ PHASE S — SYNTH HALF ON THE EXPANSION ROWS ═════════════
const globalHas = (reg, names) => names.some((n) => reg.global.has(n))

class SynthRegistry {
  constructor() { this.global = new Map(); this.own = new WeakMap() }
  #layer(scope) {
    if (scope === undefined) return undefined
    let l = this.own.get(scope); if (l === undefined) { l = new Map(); this.own.set(scope, l) }
    return l
  }
  register(callerScope, definition) {
    if (callerScope === undefined) {
      if (this.global.has(definition.name)) throw new Error(`duplicate global tool "${definition.name}"`)
      this.global.set(definition.name, definition)
      return () => this.global.delete(definition.name)
    }
    const layer = this.#layer(callerScope)
    if (layer.has(definition.name)) throw new Error(`tool "${definition.name}" is already registered in this agent scope`)
    layer.set(definition.name, definition)
    return () => layer.delete(definition.name)
  }
  ownNames(scope) { return [...(this.own.get(scope)?.keys() ?? [])].sort() }
}

async function phaseS() {
  const PLANE_URL = pathToFileURL(join(EXP, DIST_REL, 'src', 'plugin', 'live', 'team-tool-plane.mjs')).href
  const ROW_URL = pathToFileURL(join(EXP, DIST_REL, 'src', 'plugin', 'live', 'jobs-gateway-assembly.mjs')).href
  const plane = await import(PLANE_URL)
  const row = await import(ROW_URL)

  // S1 — the plane mounts the own-layer trio on a governed scope, FROM EXP.
  {
    const reg = new SynthRegistry()
    const scope = { id: 'synth-scope' }
    const built = plane.createTeamToolPlaneAssembly({
      permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any' } }] },
      realmId: 'a5int-ie-synth-realm', templateId: 'wa', role: 'member', instanceId: 'synth-inst',
    })
    const placed = built.ok === true ? built.value.mount({ tools: { register: (def) => reg.register(scope, def) } }) : { ok: false, code: 'assembly-refused' }
    const own = reg.ownNames(scope)
    check('S1', 'SYNTH(EXP): createTeamToolPlaneAssembly mounts the own-layer trio (team_grep/team_glob/team_bash) scoped-only (never global) on a governed scope, straight off the expansion module',
      placed.ok === true && ALIASES.every((n) => own.includes(n)) && globalHas(reg, ALIASES) === false,
      `own=${JSON.stringify(own)} placed=${String(placed.ok)}`)
    const d = plane.createLaneDecide({ default: 'ask', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any' } }] }, { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' })
    const bash = d({ effects: [{ kind: 'tool-invoke', toolName: 'team_bash' }, { kind: 'meta', resource: { locator: '/x' } }] })
    const grep = d({ effects: [{ kind: 'read', resource: { locator: '/x' } }, { kind: 'tool-invoke', toolName: 'team_grep' }] })
    check('S1b', 'SYNTH(EXP): the lane re-check denies the shell alias on the deny lane (template-deny-lane) and allows the read-class alias (tighten-only class mapping)',
      bash.kind === 'deny' && bash.code === 'template-deny-lane' && grep.kind === 'allow', `bash=${bash.code} grep=${grep.kind}`)
  }

  // S2 — the PR7 jobs row lease lifecycle on the expansion module.
  {
    const domain = { repositories: { memberInstances: { list: () => [] } } }
    const asm = row.createLiveJobsGatewayAssembly({ teamRoot: domain, rootSessionId: 'session-a5int-ie-synth-root' })
    const state0 = asm.lease.state()
    const refusal = asm.admitTeamJob({ jobId: 'job-1', owner: { rootSessionId: 'session-a5int-ie-synth-root', instanceId: 'ghost' }, scopeKey: 'scope-1', toolName: 'job_start' })
    const crossRoot = asm.admitTeamJob({ jobId: 'job-2', owner: { rootSessionId: 'session-OTHER', instanceId: 'inst' }, scopeKey: 'scope-1', toolName: 'job_start' })
    asm.drain(); const stateMid = asm.lease.state()
    const rel = asm.release(); const stateEnd = asm.lease.state()
    const relOk = rel === true || rel?.ok === true
    check('S2', 'SYNTH(EXP): the installed PR7 row refuses unbacked + cross-root owner claims (owner-not-durable) with zero registrations, and its assembly-owned lease walks ACTIVE→DRAINING→RELEASED honestly (the transition close() takes at teardown)',
      String(refusal?.code ?? refusal?.error?.code ?? '') === 'owner-not-durable'
        && String(crossRoot?.code ?? crossRoot?.error?.code ?? '') === 'owner-not-durable'
        && state0 === 'ACTIVE' && stateMid === 'DRAINING' && stateEnd === 'RELEASED' && relOk === true,
      `refuse=${String(refusal?.code ?? refusal?.error?.code ?? '')} states=${state0}->${stateMid}->${stateEnd} rel=${String(relOk)}`)
  }

  // S3 — the LIVE-surface result-face contract, measured on the installed
  // module (host law, core/tools/src/index.ts:217: output.render(args,value)
  // : ContentBlock[], consumed as the tool-result content at :1839).
  // The live trio legs in the team world crash at the host's result assembly
  // ('content.some is not a function'); this probe pins the exact capability
  // line on the installed artifact — a recorded gap for the GLUE formal round,
  // NOT patched here.
  {
    const built = plane.createTeamToolPlaneAssembly({
      permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
      realmId: 'a5int-ie-synth-realm-s3', templateId: 's3', role: 'member', instanceId: 's3-inst',
    })
    const def = built.ok === true ? built.value.definitions.find((d) => d.name === 'team_grep') : undefined
    const renderOut = def?.output?.render?.({}, { text: 'x' })
    const face = {
      hasOutputFace: def?.output !== undefined,
      renderReturn: renderOut === undefined ? 'no-render' : Array.isArray(renderOut) ? 'array' : typeof renderOut,
      value: typeof renderOut === 'string' ? renderOut : JSON.stringify(renderOut ?? null),
      hostLaw: 'render(args, value): ContentBlock[] (core/tools/src/index.ts:217; consumed as result content at :1839)',
      site: 'packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs:88-96 PLANE_PRESENTATION_FACE',
    }
    check('S3', 'GAP PROBE (recorded, not faked, not patched here): the installed plane DEFINITIONs carry the host-required output/render face BUT its render returns a STRING where the host law requires ContentBlock[] — through the LIVE host scheduler this crashes the result assembly ("content.some is not a function"), so neither a computed refusal NOR a future effect body can REACH the model from the trio on this artifact; capability line = PLANE_PRESENTATION_FACE.render (team-tool-plane.mjs:95) returning String(value?.text); fix owner = GLUE formal round single writer',
      face.renderReturn === 'string', `renderReturn=${face.renderReturn} site=${face.site}`)
  }
}

// ════════════════════════ BLUEPRINT AUTHORING (skill口径) ═══════════════════
function yamlScalar(value) {
  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  const s = String(value)
  return /[:#{}[\],&*?|>%@`"'—\n]|^\s|\s$/.test(s) ? JSON.stringify(s) : s
}
function yamlEmit(key, value, indent) {
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
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

const ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  '  persona: "You are the leader of the a5ie install-entry team."',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5ie install-entry team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

/**
 * The governed main blueprint (team-blueprint-authoring 口径): v3, ONE
 * complete LeaderTemplate, one member template `wa`, BOTH governed via
 * capabilities.permissions; the member allow-lanes the READ CLASS (covers the
 * read-facing own-layer aliases by class mapping) and DENIES the shell class
 * (§5.1: no positive shell permission for a member); the leader envelope
 * carries assign-task + create-member + send-message + report-progress;
 * builtinToolDeny = the discovery-computed deny list (a5w7 law).
 * `delegating` = true only for the TEAM world's blueprint; the other worlds
 * get the benign persona (reply OK, no tools).
 */
function mainBlueprintYaml(denyList, mkTask, targetFile, delegating) {
  const denyBlock = (pad) => denyList.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const task = `${mkTask} TARGET=${targetFile} Work EXACTLY in this order: (1) call the tool team_bash with arguments {"command":"echo a5ie"}; (2) then call the tool team_grep with arguments {"pattern":"A5IE_GREP_TARGET","path":"${targetFile}"}; (3) then finish with ONE line starting A5IE_MEMBER_RESULT quoting the two tool-result codes you received.`
  const leaderPersona = delegating
    ? `You are the leader of the a5ie install-entry team. On your directive: FIRST call team_delegate exactly once with rootSessionId ${CREATE_ROOT}, requestToken ${TK_DELG}, delegationTemplateId "wa", label "ie-a", async false, and the prompt ${JSON.stringify(task)}; SECOND call team_collect with rootSessionId ${CREATE_ROOT} and requestTokens ["${TK_DELG}"]; THIRD finish with one line starting A5IE_LEADER_DONE.`
    : 'You are the leader of the a5ie install-entry team. Your only directive is to reply with the single word OK. Do not call any tool.'
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'displayName: "a5ie install-entry governed team"',
    'description: "INSTALL-ENTRY: preset governed team driven from the unfolded install artifact (Leader to member delegation through the R1 tool plane)."',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:', '        - team_delegate', '        - team_collect',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5ie worker A"',
    `    persona: ${JSON.stringify('You are worker A of the a5ie install-entry team. Follow delegated work exactly.')}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []',
    '        deny:', '          - tool: bash', '            resource:', '              kind: any',
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function planeConfig(mode) {
  if (mode === 'team' || mode === 'gatered') return { realmId: `a5int-ie-realm-${mode}` }
  if (mode === 'refuse') {
    return {
      realmId: 'a5int-ie-realm-refuse',
      confinedProvider: {
        trustRoot: 'sha256:1111111111111111#vendor/launcher.bin',
        assembly: { launcherSha256: 'a'.repeat(64), launcherPath: 'vendor/launcher.bin' },
      },
    }
  }
  return undefined
}

function rowConfig(mode, blueprintDir) {
  const cfg = {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: ANCHOR_YAML,
    blueprintDir,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5int-ie-model' },
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
  const p = planeConfig(mode)
  if (p !== undefined) cfg.teamToolPlane = p
  return cfg
}

// ═══════════════════════════ WORLD DRIVER ═══════════════════════════════════
// Wire truth (rc.2): the host adapter speaks the Anthropic-style Messages API
// (mock route /v1/messages): system is a TOP-LEVEL field; assistant tool calls
// are content blocks {type:'tool_use'}; tool results are user blocks
// {type:'tool_result', content}. Every request gets ONE compact digest built
// at decide-time; bodies beyond a small window are PRUNED to the digest (the
// storm-proof ledger: memory is bounded no matter what the host does), and the
// storm guard fails a world FAST with a diagnostic instead of an OOM.
function digestRequest(parsed) {
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
        toolResults.push(rep.slice(0, 400))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  for (const m of msgs) if (m?.role === 'assistant' && Array.isArray(m?.tool_calls)) assistantToolNames.push(...m.tool_calls.map((tc) => String(tc?.function?.name ?? '')))
  const users = msgs.filter((m) => m?.role === 'user')
  const lastUser = users.length > 0 ? users[users.length - 1] : null
  const lastUserHead = String(typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content ?? '')).slice(0, 260)
  return {
    msgCount: msgs.length,
    model: String(parsed?.model ?? ''),
    toolCount: toolNames === null ? 0 : toolNames.length,
    toolNames,
    assistantToolNames,
    toolResults,
    lastUserHead,
    systemHead: sys.slice(0, 260),
    markerHits: [],
    hasDenyLane: text.includes('template-deny-lane'),
    hasIoRefusal: text.includes('IO_POLICY_UNSUPPORTED'),
    _text: text,
  }
}

async function runWorld({ mode, mock, MK, blueprintBaseDir, markers, stormLimit }) {
  const HOME = homeDir(WORKTREE, `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const BLUEPRINT_DIR = join(blueprintBaseDir, mode)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  const facts = { mode, home: HOME, ok: false, surface: 'non-pure-aux (install-manifest gap patched from tracked set; see RED-A)' }
  let host = null
  let hostExit = null
  let reqBase = 0
  try {
    if (!(await portFreeWait(HOST_PORT))) die(`port ${HOST_PORT} not free before ${mode} world`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
    const TARGET_FILE = join(HOME, 'workspace', 'a5int-ie-target.txt')
    writeFileSync(TARGET_FILE, `a5ie install-entry target line one\nprefix A5IE_GREP_TARGET suffix\nthird line\n`)
    const MK_DISC = `${MK}_${mode.toUpperCase()}_DISC`
    const MK_L0 = `${MK}_${mode.toUpperCase()}_L0`
    const MK_TASK = `${MK}_${mode.toUpperCase()}_TASK`
    const basePlugins = smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    })
    const lines = [
      `# a5ie INSTALL-ENTRY patch (run ${RUN_STAMP}, mode ${mode}): the UNFOLDED install artifact (EXP: ${EXP}) + observer row${mode === 'gatered' ? ' + the STRAY row' : ''} + smoke preset — public profile-patch seam only.`,
      '- insert:',
      ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig(mode, BLUEPRINT_DIR) }, 2),
      ...yamlEmitItem({ id: 'a5int-ie-observer', name: OBSERVER_ROW_NAME, config: {} }, 2),
      ...(mode === 'gatered' ? [...yamlEmitItem({ id: 'a5int-ie-stray', name: STRAY_ROW_NAME, config: {} }, 2)] : []),
      ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5ie base',
        description: `a5ie base preset (run ${RUN_STAMP}) = smoke preset`,
        plugins: basePlugins,
      }), 2),
      '',
    ]
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))

    const reqBaseNow = mock.requests.length
    reqBase = reqBaseNow
    const stormCheck = (where) => {
      const mine = mock.requests.length - reqBaseNow
      if (mine > stormLimit) {
        const sample = mock.requests.slice(reqBase, reqBase + 8).map((r) => ({
          seq: r.seq, path: r.path, status: r.status, error: r.error,
          digest: r.digest === undefined ? null : { ...r.digest, _text: undefined },
          reply: r.reply === null || r.reply === undefined ? null : JSON.stringify(r.reply).slice(0, 200),
        }))
        writeEvidence(`storm-diagnostic-${mode}.json`, { where, worldRequests: mine, limit: stormLimit, sample })
        die(`MODEL-CALL STORM (${mode}): ${String(mine)} model requests at "${where}" (> ${String(stormLimit)}) — diagnostic written`)
      }
    }

    const outFd = openSync(INSTANCE_RAW, 'a')
    host = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: join(HOME, 'workspace'),
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
        DEEPSEEK_API_KEY: 'a5int-ie-mock-key',
      },
    })
    host.on('exit', (code, signal) => { hostExit = { code, signal }; console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`) })
    const boot = await waitFor(120_000, () => {
      try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
    }, `${mode} boot marker`)
    facts.bootLine = redact(String(boot[0])).slice(0, 200)
    const origin = `http://127.0.0.1:${boot[1]}`
    const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`${mode} token gate ${String(auth.status)}`)
    await waitFor(30_000, async () => {
      const h = await fetchJson(`${origin}/__a5ie/health`).catch(() => null)
      return h?.status === 200 && h.body?.applied === true ? h : false
    }, `${mode} observer applied`)
    stormCheck('post-boot (NO prompt sent yet)')

    const wireHit = (needle) => (mock.requests ?? []).find((r) => r.digest !== undefined && r.digest.markerHits.includes(needle) && r.digest.toolCount > 0)
    async function promptBarrier({ sessionId, textBase, rpcTag, attempts = 10, perAttemptMs = 25_000 }) {
      let lastStatus = 0
      for (let k = 1; k <= attempts; k += 1) {
        stormCheck(`barrier ${textBase.slice(0, 30)} attempt ${String(k)}`)
        const res = await fetchJson(`${origin}/api/session/prompt`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
          body: JSON.stringify({ type: 'client-request', rpcId: `${rpcTag}-a${k}`, method: 'session/prompt', payload: { args: { request: { requestId: `${rpcTag}-a${k}-r`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${textBase} (barrier probe ${k}) This is a setup turn. Do not call any tools. Reply OK.` }] } } } }),
        }, 240_000)
        lastStatus = res.status
        const hit = await waitQuiet(perAttemptMs, async () => wireHit(textBase))
        if (hit) return { hit, attempts: k, lastStatus }
      }
      die(`barrier: no wire request for "${textBase.slice(0, 40)}…" after ${attempts} prompt attempts on ${sessionId} (last HTTP ${lastStatus})`)
    }

    // Discovery turn on the BOOT root → the governed deny list (a5w7 law).
    const disc = await promptBarrier({ sessionId: ROOT, textBase: MK_DISC, rpcTag: `a5int-ie-${mode}-d` })
    facts.discPrompt = { attempts: disc.attempts, status: disc.lastStatus }
    const surface = [...new Set(disc.hit.digest.toolNames ?? [])].sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    facts.discoverySurface = surface
    facts.denyList = denyList
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml(denyList, MK_TASK, TARGET_FILE, mode === 'team'))

    // LIVE PRE-FLIGHT (team-blueprint-authoring §7): catalog.list + catalog.get.
    const cl = await fetchJson(`${origin}/team-remote/catalog.list`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5int-ie-pre-1', method: 'catalog.list', payload: { version: 4, params: {} } }),
    }, 30_000)
    const listed = JSON.stringify(cl.body ?? '').includes(BP_MAIN_ID)
    const cg = await fetchJson(`${origin}/team-remote/catalog.get`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'a5int-ie-pre-2', method: 'catalog.get', payload: { version: 4, params: { blueprintId: BP_MAIN_ID, blueprintRevision: 1 } } }),
    }, 30_000)
    facts.catalogPreflight = { listStatus: cl.status, listed, getStatus: cg.status, getErr: cg.status !== 200 ? redact(JSON.stringify(cg.body)).slice(0, 300) : null }
    facts.catalogPreflightOk = listed && cg.status === 200

    // The governed Team.
    const created = await fetchJson(`${origin}/team-remote/team.create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `a5int-ie-${mode}-tc`, method: 'team.create', payload: { version: 1, params: { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: `${MK_L0} Begin your directive.` } } } }),
    }, 90_000)
    facts.teamCreate = { status: created.status, body: redact(JSON.stringify(created.body ?? null)).slice(0, 1400) }

    const EXPECTED_ERROR = mode === 'gatered' ? /alpha2-permission-coverage-unmanaged-tools|unknown-unmanaged/
      : mode === 'refuse' ? /TRUST_ROOT_SHA_MISMATCH|alpha5-team-tool-plane-trust_root_sha_mismatch/ : null
    if (EXPECTED_ERROR !== null) {
      facts.errorInBody = EXPECTED_ERROR.test(String(facts.teamCreate?.body ?? ''))
      facts.expectedErrorLine = await waitForLogLine(INSTANCE_RAW, EXPECTED_ERROR, 45_000)
      facts.errorSeen = facts.errorInBody || facts.expectedErrorLine !== null
    } else if (mode === 'team') {
      // Delegation chain: the mock scripts leader (delegate→collect→DONE) and
      // member (read SUCCESS → team_bash deny → team_grep IO-refusal → final).
      const first = await waitFor(180_000, async () => {
        const hit = wireHit(MK_L0)
        return hit ?? false
      }, `${mode} leader turn at the mock`)
      facts.leaderWireSeq = first.seq
      facts.leaderWireCatalog = first.digest.toolNames
      const chain = await waitFor(300_000, async () => {
        stormCheck('leader chain')
        const reqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
        if (reqs.length === 0) return false
        const doneReplied = reqs.some((r) => JSON.stringify(r.reply ?? '').includes('A5IE_LEADER_DONE'))
        if (!doneReplied) return false
        const last = reqs[reqs.length - 1]
        return { toolCalls: last.digest.assistantToolNames, backToLeader: last.digest._text.includes('A5IE_MEMBER_RESULT'), lastUserHead: last.digest.lastUserHead }
      }, `${mode} leader chain (delegate + collect + final reply)`)
      facts.leaderToolCalls = chain.toolCalls
      facts.memberResultBackToLeader = chain.backToLeader
      facts.leaderFinalSeen = true
      const memberReqs = (mock.requests ?? []).filter((r) => r.digest?.markerHits.includes(MK_TASK) && !r.digest.markerHits.includes(MK_L0) && r.digest.toolCount > 0)
      facts.memberRequestCount = memberReqs.length
      facts.memberWireSeq = memberReqs[0]?.seq ?? null
      facts.memberWireCatalog = memberReqs[0]?.digest.toolNames ?? null
      const lastM = memberReqs[memberReqs.length - 1]
      facts.memberSawDenyLane = lastM?.digest.hasDenyLane ?? false
      facts.memberSawIoRefusal = lastM?.digest.hasIoRefusal ?? false
      facts.memberToolResults = lastM?.digest.toolResults ?? []
      // ① POSITIVE CONTROL (root ruling): the governed `read` tool must have
      // really EXECUTED — its tool_result carries the file content line.
      facts.memberReadResult = (facts.memberToolResults[0] ?? '')
      facts.memberReadSucceeded = (facts.memberToolResults[0] ?? '').includes('A5IE_GREP_TARGET')
      facts.memberBashDenied = (facts.memberToolResults[1] ?? '').includes('template-deny-lane')
      facts.memberGrepIoRefused = (facts.memberToolResults[2] ?? '').includes('IO_POLICY_UNSUPPORTED')
      facts.memberFinalReply = (memberReqs.find((r) => JSON.stringify(r.reply ?? '').includes('A5IE_MEMBER_RESULT'))?.reply ?? null)
      facts.delegatedTaskOnMemberWire = memberReqs.length > 0
      facts.sessions = await waitFor(60_000, async () => {
        const sl = await fetchJson(`${origin}/api/session/list`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' }, body: JSON.stringify({ type: 'client-request', rpcId: 'a5int-ie-sessions', method: 'session/list', payload: { args: { _request: {} } } }) }, 15_000)
        const items = sl.body?.result?.value?.items ?? []
        return items.length > 0 && items.every((i) => i.running !== true) ? items.map((i) => ({ s: String(i.sessionId ?? '').slice(-14), run: i.running === true })) : false
      }, `${mode} all sessions quiet (turns complete)`)
    } else {
      const hit = await waitFor(180_000, async () => {
        const h = wireHit(MK_L0)
        return h ?? false
      }, `${mode} leader turn at the mock`)
      facts.leaderWireSeq = hit.seq
      facts.leaderWireCatalog = hit.digest.toolNames
    }

    // The two NON-team sessions (shipped presets), one setup turn each.
    for (const preset of PRESETS) {
      const MKP = `${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`
      const c = await fetchJson(`${origin}/api/session/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5int-ie-${mode}-${preset}-c`, method: 'session/create', payload: { args: { request: { agentPreset: preset } } } }),
      }, 60_000)
      const sessionId = c.body?.result?.value?.sessionId ?? c.body?.value?.sessionId ?? null
      facts[preset] = { sessionId, createStatus: c.status }
      if (typeof sessionId !== 'string' || sessionId === '') { facts[preset].failed = true; continue }
      const presHit = await promptBarrier({ sessionId, textBase: MKP, rpcTag: `a5int-ie-${mode}-${preset}-p`, attempts: 10 })
      facts[preset].promptAttempts = presHit.attempts
      facts[preset].wireCatalog = [...new Set(presHit.hit.digest.toolNames ?? [])].sort()
    }

    const observed = await waitFor(120_000, async () => {
      const f = await fetchJson(`${origin}/__a5ie/facts?names=${encodeURIComponent([...ALIASES, 'team_stray'].join(','))}&roots=${encodeURIComponent(CREATE_ROOT)}`).catch(() => null)
      if (f?.status !== 200) return false
      const live = (f.body.agents ?? []).filter((a) => Array.isArray(a.scopedNames))
      return live.length >= PRESETS.length ? f.body : false
    }, `${mode} observer facts`)
    facts.globalNames = observed.globalNames
    facts.planeObservations = observed.planeObservations
    facts.liveJobsGateway = observed.liveJobsGateway
    facts.ownLayerCarrierCount = (observed.agents ?? []).filter((a) => ALIASES.every((n) => a.perName?.[n]?.scopedPresent === true && a.perName?.[n]?.globalPresent === false)).length
    const byId = {}
    for (const a of observed.agents ?? []) byId[a.session] = a
    facts.leader = byId[CREATE_ROOT] ?? null
    for (const preset of PRESETS) {
      const sid = facts[preset]?.sessionId
      facts[preset].scopedNames = byId[sid]?.scopedNames ?? null
    }
    facts.ok = true
    return facts
  } finally {
    writeEvidence(`world-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 3000))
    facts.hostExit = hostExit
    // full per-request ledger (digests; bodies were pruned storm-side) — the
    // evidence trail for WHO called WHAT and WHAT came back.
    try {
      const lines = mock.requests.slice(reqBase).map((r) => JSON.stringify({
        seq: r.seq, path: r.path, status: r.status, reply: r.reply === undefined ? null : redact(JSON.stringify(r.reply)).slice(0, 300),
        digest: r.digest === undefined ? null : { ...r.digest, markerHits: r.digest.markerHits.filter((x) => x.startsWith('A5IE')), systemHead: redact(r.digest.systemHead), lastUserHead: redact(r.digest.lastUserHead), toolResults: r.digest.toolResults.map((x) => redact(x)), _text: `${r.digest._text.length} chars` },
      }))
      writeFileSync(join(EVIDENCE_DIR, `wire-digests-${mode}.jsonl`), lines.join('\n') + '\n')
    } catch { /* best effort */ }
    try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
}

// ═══════════════════════════ MAIN ═══════════════════════════════════════════
const rnd = () => Math.random().toString(36).slice(2, 10)
const toolCall = (id, name, argsObj) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: argsObj }] })

async function main() {
  console.log(`a5ie install-entry runner stamp=${RUN_STAMP} port=${HOST_PORT} exp=${EXP}`)
  if (args.includes('--heartbeat')) {
    setInterval(() => {
      const m = process.memoryUsage()
      console.log(`[hb] rss=${Math.round(m.rss / 2 ** 20)}MB heap=${Math.round(m.heapUsed / 2 ** 20)}MB mockReqs=${main.mockReqs ?? 0}`)
    }, 5000).unref()
  }
  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('H1', `the test-use host is the pinned pristine 0.2.0-rc.2 runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)} (porcelain ${porcelainBefore === '' ? 0 : 'DIRTY'} before)`,
    head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)}`)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('H2', `host port ${HOST_PORT} free (self-proved) and a mock port from the 349x family free`, (await portFree(HOST_PORT)) && mockPort > 0, `mock=${mockPort}`)
  const stableBefore = await stableProbe()

  const eFacts = phaseE()
  await phaseE5RedA()
  await phaseS()

  const MK = `A5IE_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  // every marker the digester should index (bounded list, no regex per request)
  const markers = []
  for (const mode of MODES) {
    const MU = mode.toUpperCase()
    markers.push(`${MK}_${MU}_DISC`, `${MK}_${MU}_L0`)
    if (mode === 'team') markers.push(`${MK}_${MU}_TASK`)
    for (const preset of PRESETS) markers.push(`${MK}_${MU}_${preset.toUpperCase()}_SETUP`)
  }
  markers.push('A5IE_MEMBER_RESULT', 'A5IE_LEADER_DONE')

  const mock = await startMockModel({
    port: mockPort,
    log: () => {},
    decide: ({ req }) => {
      main.mockReqs = (main.mockReqs ?? 0) + 1
      const msgs = req?.messages ?? []
      const digest = digestRequest(req)
      digest.markerHits = markers.filter((mk) => digest._text.includes(mk))
      const rec = mock.requests[mock.requests.length - 1]
      if (rec !== undefined) {
        rec.digest = digest
        // storm-proof ledger: bodies beyond the live window collapse to the
        // digest (the digest was computed once, here, at arrival).
        if (rec.seq > 6 && mock.requests[rec.seq - 6]?.body !== null) {
          const old = mock.requests[rec.seq - 6]
          if (old !== undefined && old.body !== null) old.body = { __pruned: true, msgCount: old.digest?.msgCount, toolCount: old.digest?.toolCount }
        }
      }
      const text = digest._text
      for (const mode of MODES) {
        const MU = mode.toUpperCase()
        if (text.includes(`${MK}_${MU}_DISC`)) return { kind: 'text', content: 'A5IE_DISC_OK' }
        for (const preset of PRESETS) {
          if (text.includes(`${MK}_${MU}_${preset.toUpperCase()}_SETUP`)) return { kind: 'text', content: 'A5IE_PRESET_OK' }
        }
        if (mode === 'team' && text.includes(`${MK}_${MU}_L0`)) {
          // LEADER first (initialWork carries MK_L0; the member never sees it).
          const calls = digest.assistantToolNames
          if (calls.length === 0) {
            const target = /TARGET=(\S+)/.exec(text)?.[1] ?? ''
            return toolCall(`call-a5int-ie-delegate-${rnd()}`, 'team_delegate', {
              rootSessionId: CREATE_ROOT, requestToken: TK_DELG, delegationTemplateId: 'wa', label: 'ie-a',
              taskSummary: 'install-entry read-success + trio refusal probe',
              prompt: `${MK}_${MU}_TASK TARGET=${target} Do the delegated work exactly as instructed in your system persona.`,
              async: false,
            })
          }
          if (calls.length === 1) return toolCall(`call-a5int-ie-collect-${rnd()}`, 'team_collect', {
            rootSessionId: CREATE_ROOT, requestToken: `a5int-ie-collect-${RUN_STAMP}`, requestTokens: [TK_DELG],
          })
          return { kind: 'text', content: 'A5IE_LEADER_DONE' }
        }
        if (mode === 'team' && text.includes(`${MK}_${MU}_TASK`)) {
          // MEMBER chain: (1) read SUCCESS (positive control), (2) team_bash
          // (deny-lane), (3) team_grep (IO refusal), (4) final quoting all.
          const calls = digest.assistantToolNames
          const target = /TARGET=(\S+)/.exec(text)?.[1] ?? '/a5int-ie-missing'
          if (calls.length === 0) return toolCall(`call-a5int-ie-read-${rnd()}`, 'read', { file_path: target })
          if (calls.length === 1) return toolCall(`call-a5int-ie-bash-${rnd()}`, 'team_bash', { command: 'echo a5ie' })
          if (calls.length === 2) return toolCall(`call-a5int-ie-grep-${rnd()}`, 'team_grep', { pattern: 'A5IE_GREP_TARGET', path: target })
          const sawRead = text.includes('A5IE_GREP_TARGET suffix')
          const sawDeny = digest.hasDenyLane
          const sawIo = digest.hasIoRefusal
          return { kind: 'text', content: `A5IE_MEMBER_RESULT read=${sawRead ? 'SUCCESS-saw-line2' : 'n/a'} bash=${sawDeny ? 'template-deny-lane' : 'n/a'} grep=${sawIo ? 'IO_POLICY_UNSUPPORTED' : 'n/a'}` }
        }
        if (text.includes(`${MK}_${MU}_L0`)) return { kind: 'text', content: 'A5IE_L0_OK' }
      }
      return { kind: 'text', content: 'a5int-ie-mock: unscripted request, completing quietly.' }
    },
  })

  const worlds = {}
  try {
    for (const mode of MODES) worlds[mode] = await runWorld({ mode, mock, MK, blueprintBaseDir: join(EVIDENCE_DIR, 'blueprints'), markers, stormLimit: Number(argValue('storm-limit', 250)) })
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  const stableAfter = await stableProbe()
  check('H3', ':3080 stable instance untouched (read-only probe before/after) and the test-use host porcelain 0 after',
    String(stableBefore) === String(stableAfter) && porcelainAfter === '', `${String(stableBefore)} -> ${String(stableAfter)}; porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  for (const mode of MODES) writeEvidence(`world-${mode}.json`, worlds[mode] ?? { missing: true })
  check('W1', 'all worlds booted from the EXPANSION row name, driven, observer facts captured (worlds swept)',
    MODES.every((m) => worlds[m]?.ok === true), MODES.map((m) => `${m}:${worlds[m]?.ok === true ? 'ok' : 'FAIL'}${worlds[m]?.swept ? '/swept' : '/UNSWEPT'}`).join(' '))

  const t = worlds.team ?? {}
  const b = worlds.baseline ?? {}

  // ② governed-team delegation: POSITIVE CONTROL + refusal-chain legs
  if (MODES.includes('team')) {
    check('T1', 'LIVE PRE-FLIGHT (skill §7): the saved blueprint lists in catalog.list AND resolves (strong parse) in catalog.get on the EXPANSION-powered host',
      t.catalogPreflightOk === true, JSON.stringify(t.catalogPreflight ?? null).slice(0, 200))
    const leaderScoped = t.leader?.scopedNames ?? []
    const leaderOwnLayer = ALIASES.every((n) => t.leader?.perName?.[n]?.scopedPresent === true && t.leader?.perName?.[n]?.globalPresent === false)
    const placedRows = (t.planeObservations ?? []).filter((o) => String(o).startsWith('a5-plane: placed [team_grep,team_glob,team_bash]'))
    check('T2', 'R1 PLACEMENT live on the installed surface: the governed leader carries the own-layer trio (scoped yes, global NO), BOTH governed agents are own-layer carriers, and the assembly logged its placement rows',
      ALIASES.every((n) => leaderScoped.includes(n)) && leaderOwnLayer && placedRows.length >= 2 && (t.ownLayerCarrierCount ?? 0) >= 2,
      `leaderScoped=${JSON.stringify(leaderScoped.filter((n) => n.startsWith('team_')))} placedRows=${placedRows.length} carriers=${String(t.ownLayerCarrierCount)}`)
    const leaderWire = t.leaderWireCatalog ?? []
    check('T3', 'the placement reached the model-facing WIRE of BOTH governed agents: leader wire carries team_delegate+team_collect+aliases; the member wire carries the aliases',
      ['team_delegate', 'team_collect', ...ALIASES].every((n) => leaderWire.includes(n)) && ALIASES.every((n) => (t.memberWireCatalog ?? []).includes(n)),
      `leader team_*=${JSON.stringify([...new Set(leaderWire.filter((n) => n.startsWith('team_')))])} member team_*=${JSON.stringify([...new Set((t.memberWireCatalog ?? []).filter((n) => n.startsWith('team_')))])}`)
    check('T4', 'REAL delegation: the leader scripted team_delegate(sync)+team_collect over template wa; the member-bound session received the delegated task prompt AT THE WIRE with a multi-request transcript',
      ['team_delegate', 'team_collect'].every((n) => (t.leaderToolCalls ?? []).includes(n)) && t.delegatedTaskOnMemberWire === true && (t.memberRequestCount ?? 0) >= 4,
      `leaderToolCalls=${JSON.stringify(t.leaderToolCalls ?? [])} memberReqs=${String(t.memberRequestCount)}`)
    check('T5', '① POSITIVE CONTROL (root ruling): the GOVERNED read tool really EXECUTED on the member — the governed lane allowed read-class, the host core backend ran the file read, and the tool result carries the target file content (A5IE_GREP_TARGET line) — a small task completed for real',
      t.memberReadSucceeded === true, `readSucceeded=${String(t.memberReadSucceeded)} result=${JSON.stringify(t.memberReadResult ?? '').slice(0, 180)}`)
    check('T6', 'REFUSAL-CHAIN leg 1 (never counted as the positive control): the own-layer trio call team_bash through the R1 placement was DENIED by the lane (template-deny-lane) BEFORE any backend ran',
      t.memberBashDenied === true && (t.memberToolResults ?? []).length >= 3, `bashDenied=${String(t.memberBashDenied)} results=${JSON.stringify(t.memberToolResults ?? []).slice(0, 200)}`)
    check('T7', 'REFUSAL-CHAIN leg 2 + LOCALIZED GAP (never counted as the positive control): the own-layer trio call team_grep reached the INSTALLED effect face and got the typed IO_POLICY_UNSUPPORTED — the CHAIN (wire→guard→lane→pipeline→backend edge) runs on the installed surface, but the trio effect bodies are typed-shut: capability = createTeamToolPlaneAssembly default effect backends (team_grep/team_glob/team_bash) in live/team-tool-plane.mjs; provider assembly = GLUE formal round, NOT delivered by this artifact',
      t.memberGrepIoRefused === true,
      `grepIoRefused=${String(t.memberGrepIoRefused)} gap=trio-effect-backends/team-tool-plane.mjs memberFinal=${JSON.stringify(t.memberFinalReply ?? null).slice(0, 160)}`)
    check('T8', 'RESULT BACK TO LEADER: the member final line (A5IE_MEMBER_RESULT quoting read-success + both refusal codes) is present in the LEADER wire transcript inside the delegate/collect chain, and the leader completed its final turn',
      t.memberResultBackToLeader === true && t.leaderFinalSeen === true && JSON.stringify(t.memberFinalReply ?? '').includes('read=SUCCESS'), `backToLeader=${String(t.memberResultBackToLeader)} final=${JSON.stringify(t.memberFinalReply ?? null).slice(0, 140)}`)
    check('T9', 'LEDGER: every driven turn COMPLETED (all sessions quiet), the PR7 live row is open for the owning root through the production entry (gateway+lease witness, lease ACTIVE pre-close), and the host took the graceful SIGTERM close (exit 0 = close() ran to the end, where the lease drains/releases — the S2-measured lifecycle)',
      Array.isArray(t.sessions) && t.sessions.every((s) => s.run !== true) && t.liveJobsGateway?.[CREATE_ROOT]?.present === true && t.liveJobsGateway?.[CREATE_ROOT]?.hasGateway === true && t.liveJobsGateway?.[CREATE_ROOT]?.leaseState === 'ACTIVE' && t.hostExit?.code === 0,
      `sessions=${JSON.stringify(t.sessions ?? null).slice(0, 140)} gw=${JSON.stringify(t.liveJobsGateway?.[CREATE_ROOT] ?? null)} exit=${JSON.stringify(t.hostExit ?? null)}`)
  }
  if (MODES.includes('baseline')) {
    const baselineClean = (b.planeObservations ?? []).length === 0 && !(b.leader?.scopedNames ?? []).some((n) => ALIASES.includes(n))
      && b.liveJobsGateway?.[CREATE_ROOT]?.present !== true
    check('T10', 'control-of-controls: the BASELINE governed leader (same expanded artifact, NO row config) shows zero plane aliases, zero plane observations and NO jobs gateway — the mount is config-scoped, not ambient',
      baselineClean, `aliases=${JSON.stringify((b.leader?.scopedNames ?? []).filter((n) => ALIASES.includes(n)))} obs=${JSON.stringify(b.planeObservations ?? []).slice(0, 120)}`)
  }

  // ③ non-team zero-expansion, same round, both faces
  if (MODES.includes('baseline') && MODES.includes('team')) {
    const setDiff = (a, c) => (Array.isArray(a) ? a : []).filter((n) => !(Array.isArray(c) ? c : []).includes(n))
    for (const preset of PRESETS) {
      const regDelta = setDiff(t[preset]?.scopedNames, b[preset]?.scopedNames)
      const wireDelta = setDiff(t[preset]?.wireCatalog, b[preset]?.wireCatalog)
      const clean = (t[preset]?.scopedNames ?? []).filter((n) => n.startsWith('team_')).length === 0
        && (t[preset]?.wireCatalog ?? []).filter((n) => n.startsWith('team_')).length === 0
      check(`Z-${preset}`, 'ZERO EXPANSION (same round): the ' + preset + ' NON-team session registry-vs-baseline = [] AND wire-vs-baseline = [] AND zero team_ alias names on either face — while the SAME boot carries a live mounted plane',
        regDelta.length === 0 && wireDelta.length === 0 && clean,
        `regΔ=${JSON.stringify(regDelta)} wireΔ=${JSON.stringify(wireDelta)}`)
    }
  }

  // ④ negative controls still red (on the expanded surface)
  if (MODES.includes('gatered')) {
    const g = worlds.gatered ?? {}
    const gErr = `${String(g.expectedErrorLine ?? '')} ${g.errorInBody === true ? String(g.teamCreate?.body ?? '') : ''}`
    const gNonTeam = PRESETS.every((preset) => g[preset]?.createStatus === 200 && g[preset]?.failed !== true)
    check('N3', 'COVERAGE GATE STILL RED on the expanded surface: plane mounted AND a team_-namespace masquerader on the governed surface → setup dies on alpha2-permission-coverage-unmanaged-tools (body or console) — the plane did not whiten the gate — while NON-team sessions are untouched',
      g.errorSeen === true && /alpha2-permission-coverage-unmanaged-tools|unknown-unmanaged/.test(gErr) && gNonTeam, `seen=${g.errorSeen} inBody=${g.errorInBody} nonTeam=${gNonTeam}`)
  }
  if (MODES.includes('refuse')) {
    const r = worlds.refuse ?? {}
    const rErr = `${String(r.expectedErrorLine ?? '')} ${r.errorInBody === true ? String(r.teamCreate?.body ?? '') : ''}`
    check('N4', 'BOOT/PAIRING NEGATIVE STILL RED: a half-paired trustRoot row refuses the governed setup with the typed TRUST_ROOT_SHA_MISMATCH (body or console; no degraded fallback, no partial mount)',
      r.errorSeen === true, `seen=${String(r.errorSeen)} inBody=${String(r.errorInBody)} err=${rErr.slice(0, 160)}`)
    const rNoAlias = !(r.leader?.scopedNames ?? []).some((n) => ALIASES.includes(n))
    check('N4b', 'the refused world shows NO plane alias anywhere (the refusal unwound everything it touched)',
      rNoAlias && (r.planeObservations ?? []).every((o) => !String(o).startsWith('a5-plane: placed')), `aliases=${JSON.stringify((r.leader?.scopedNames ?? []).filter((n) => ALIASES.includes(n)))}`)
  }

  // teardown: sweep the expansion itself (manifest already committed)
  if (!KEEP) { try { rmSync(EXP, { recursive: true, force: true }) } catch { /* best effort */ } }
  const homesRoot = join(WORKTREE, 'tests', 'homes')
  const a5ieHomes = existsSync(homesRoot) ? readdirSync(homesRoot).filter((d) => d.startsWith('a5int-ie-')) : []
  check('C1', 'world cleanup: no a5int-ie-* DSH_HOME remains under tests/homes and both expansions (aux + RED-A pure) are swept (their per-file sha256 manifests are the retained evidence)',
    !existsSync(EXP) && !existsSync(`${EXP}-pure`) && a5ieHomes.length === 0, `exp=${String(!existsSync(EXP))} pure=${String(!existsSync(`${EXP}-pure`))} homes=${JSON.stringify(a5ieHomes)}`)

  const rawLeft = MODES.filter((m) => existsSync(join(EVIDENCE_DIR, `instance-${m}.raw.log`)))
  check('C2', 'launch-token hygiene: raw instance logs deleted after redaction at capture (only redacted *.log retained)', rawLeft.length === 0, `rawLeft=${JSON.stringify(rawLeft)}`)

  writeEvidence('criteria.json', { runStamp: RUN_STAMP, port: HOST_PORT, expansion: EXP, head: gitAt(WORKTREE, 'rev-parse', 'HEAD'), fileCount: eFacts?.fileCount, criteria: CRITERIA })
  const red = CRITERIA.filter((c) => !c.pass)
  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`} (${CRITERIA.length - red.length}/${CRITERIA.length})`)
  process.exit(red.length === 0 ? 0 : 2)
}

main().then(
  () => process.exit(0),
  async (error) => {
    console.log(`FATAL ${redact(String(error?.stack ?? error)).split('\n').slice(0, 8).join(' | ')}`)
    writeEvidence('fatal.json', { error: redact(String(error?.message ?? error)), criteriaSoFar: CRITERIA })
    process.exit(1)
  },
)
