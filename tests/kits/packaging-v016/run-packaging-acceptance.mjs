#!/usr/bin/env node
/**
 * run-packaging-acceptance.mjs — the v0.1.6 PACKAGING-LANE driver.
 *
 * WHAT THIS PROVES, IN ORDER (one invocation = one measurement):
 *
 *   1. GATES   — version `0.1.6` is identical across the root manifest and every
 *                shipping workspace package; the tree is CLEAN; a real rebuild
 *                (`pnpm -r run build` + `pnpm run build:composition`) leaves
 *                `git status --porcelain` empty and
 *                `scripts/check-artifacts-committed.mjs` returns `verdict=ok`
 *                (so the committed `dist`/`composition-shim` bytes are what a
 *                fresh build produces — no stale artifact).
 *   2. PACK    — `pnpm pack` produces a tarball whose INTERNAL
 *                `package/package.json` names the SAME version, whose sha256 /
 *                bytes / member count are recorded, and whose provenance is the
 *                exact commit that was packed (HEAD, clean, unchanged by the
 *                build).
 *   3. INSTALL — the tarball is installed with the PINNED PRISTINE HOST CLI
 *                (`apps/cli/lib/bin.js plugin --profile web add <tarball>`) into
 *                a FRESH directory + FRESH `DSH_HOME` under `tests/homes/`
 *                (no repo `node_modules` is linked or reused).
 *   4. LIVE    — from that installed profile, the proven packaged-acceptance
 *                instrument (`tests/kits/v016-packaged-acceptance`) boots a real
 *                Host and drives Team → Member → governed execute → Goal →
 *                Stop → collect → cold recovery. This driver passes
 *                `--member-io-ceilings`, so the ONE v5 blueprint carries BOTH
 *                `memberIoCeilings` and `reviewRouting`, and it reads the
 *                DURABLE `blueprint_registry` row (source + contentHash) as the
 *                typed surface — not the request it sent.
 *   5. UPGRADE / ROLLBACK — a SECOND tarball (an earlier, same-version 0.1.6
 *                build) is installed OVER the live installation, then the first
 *                tarball is installed back. What survives and what does not is
 *                measured: DSH_HOME durable bytes, the installed artifact
 *                identity, and whether the Host still reads the existing Team.
 *
 * WHAT IT DOES NOT DO (stated, never implied):
 *
 *   - It does NOT define an upgrade protocol. The product has none: the only
 *     primitive is `dsh plugin add` (a package-manager install). There is no
 *     version negotiation, no data migration, no `rollback` command, and no
 *     compatibility check across plugin versions. Rollback here is literally
 *     "install the previous tarball again". Where a boot after a swap fails,
 *     that is recorded as a finding, not repaired.
 *   - It is not a release: no `npm publish`, no `git tag`, no push, no
 *     Authority move, no candidate freeze. Evidence class DEV-LIVE.
 *   - It does not make a V@B or CANDIDATE-C2 claim.
 *   - The model transport is the in-tree deterministic mock (a SCRIPTED
 *     oracle): it decides which tool a member calls, not whether the product
 *     works. Every durable fact, install, process life-cycle and side effect is
 *     real. Same oracle class the C2-B evidence used; no real vendor model.
 *
 * SAFE TO RE-RUN: every run gets a fresh `tests/homes/<world>` (deleted at exit
 * unless `--keep`), fresh evidence run dirs keyed by `--run`, and never writes
 * product files. Re-running with the same `--run` overwrites only its own
 * evidence directory. The pristine host checkout is checked byte-clean before
 * and after.
 *
 * USAGE
 *   node tests/kits/packaging-v016/run-packaging-acceptance.mjs \
 *     [--run <label>] [--evidence-dir <path>] [--second-tarball <path>] \
 *     [--host-port N] [--mock-port N] [--skip-rebuild] [--skip-live] \
 *     [--skip-upgrade] [--keep] [--worktree <path>] [--testuse <path>] \
 *     [--phase gates|pack|install|live|upgrade|all]
 *
 *   --second-tarball  the artifact installed OVER the first, and rolled back
 *                     from. REQUIRED unless --skip-upgrade. It must be the
 *                     output of packing a DIFFERENT commit (see the README for
 *                     the exact command); the driver records its commit when it
 *                     can read one from `--second-commit`.
 *   --second-commit   provenance commit for --second-tarball (optional; when
 *                     absent the tarball identity is recorded without a commit).
 *
 * PORTS: the driver uses the shipped packaged instrument's 140xx family
 * (`--host-port`/`--mock-port`, default 14021/14091 + run is not numeric-safe,
 * so pass them explicitly when re-running in parallel). Loopback only; :3080 is
 * never contacted. Ports must be inside `tests/paths.mjs` TEST_PORT_RANGES.
 *
 * EXIT: 0 = every check PASS; 2 = at least one check FAILED (each failure is
 * named and its evidence path is printed); 1 = fatal (environment/pack/install/
 * boot — nothing measured). A failure is a FINDING, never papered over.
 */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import {
  CLIENT_COMMIT_HASH, DSH_BASELINE_VERSION, HOST_PORT_BANDS, MOCK_PORT_BANDS,
  TEST_USE_BASELINE_SHA, isSanctionedTestPort, portsOfBands,
} from '../../../tests/paths.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2)
function argValue(name, dflt) {
  const i = ARGS.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = ARGS[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
const RUN = String(argValue('run', '1'))
const PHASE = String(argValue('phase', 'all'))
const PHASE_VALID = ['all', 'gates', 'pack', 'install', 'live', 'upgrade']
if (!PHASE_VALID.includes(PHASE)) throw new Error(`--phase must be one of ${PHASE_VALID.join('|')}`)
const FLAG_KEEP = ARGS.includes('--keep')
const FLAG_SKIP_REBUILD = ARGS.includes('--skip-rebuild')
const FLAG_SKIP_LIVE = ARGS.includes('--skip-live') || PHASE === 'gates' || PHASE === 'pack' || PHASE === 'install'
const FLAG_SKIP_UPGRADE = ARGS.includes('--skip-upgrade') || !['all', 'upgrade'].includes(PHASE)
const SECOND_TARBALL_ARG = argValue('second-tarball', null)
const SECOND_COMMIT_ARG = argValue('second-commit', null)
const TARBALL_ARG = argValue('tarball', null)
const HOST_PORT_ARG = argValue('host-port', null)
const MOCK_PORT_ARG = argValue('mock-port', null)

// Resolve the pristine host checkout: this worktree normally does not contain it
// (gitignored), so fall back to the MAIN checkout that owns this worktree.
let TESTUSE = resolve(argValue('testuse', join(REPO, 'tests', 'deepseek-harness-test-use')))
if (!existsSync(join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'))) {
  const main = resolve(REPO, '..', '..')
  if (existsSync(join(main, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib', 'bin.js'))) {
    TESTUSE = join(main, 'tests', 'deepseek-harness-test-use')
  }
}
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const MAIN_CHECKOUT = existsSync(join(REPO, '..', '..', 'package.json')) ? resolve(REPO, '..', '..') : REPO
const STORE_DIR = existsSync(join(MAIN_CHECKOUT, '.artifacts', 'pnpm-store'))
  ? join(MAIN_CHECKOUT, '.artifacts', 'pnpm-store')
  : join(REPO, '.artifacts', 'pnpm-store')

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const EVIDENCE = resolve(argValue('evidence-dir', join(REPO, 'dev', 'agent-workflow', 'evidence', 'packaging-v016-20261112')))
const RUN_DIR = join(EVIDENCE, `run-${RUN}`)
const WORLD_NAME = `packaging-v016-${RUN}-${STAMP}`
const WORLD = join(REPO, 'tests', 'homes', WORLD_NAME)
const HOME = join(WORLD, 'home')
const PROJECT = join(WORLD, 'project')
const PROFILE = join(HOME, 'profiles', 'web')
const WS = join(WORLD, 'workspace')

// ── logging / evidence ──────────────────────────────────────────────────────

mkdirSync(RUN_DIR, { recursive: true })
const RUN_LOG = join(RUN_DIR, 'driver.log')
writeFileSync(RUN_LOG, '')
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  process.stdout.write(`${text}\n`)
  appendFileSync(RUN_LOG, `${text}\n`)
}
function writeEvidence(name, value) {
  const path = join(RUN_DIR, name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`)
  return path
}
const CHECKS = []
function check(id, name, ok, detail) {
  CHECKS.push({ id, name, ok: ok === true, detail: String(detail ?? '') })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id}: ${name} — ${String(detail ?? '')}`)
  return ok === true
}
const SUMMARY = { schema: 'packaging-v016/1', run: RUN, world: null, gates: {}, pack: {}, install: {}, live: {}, upgrade: {}, rollback: {} }

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex')
}
/** The paths whose cleanliness defines "the pack describes a commit": the
 *  shipped product surface. The lane's own instrument/evidence files are
 *  deliberately NOT in this set — an uncommitted DRIVER must not be able to
 *  make the PACKED artifact look dirty, and must not be able to hide a dirty
 *  product file either. Full porcelain is still recorded for the reviewer. */
const PRODUCT_CLEAN_PATHS = [
  'packages', 'scripts', 'tests/paths.mjs', 'package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'pnpm-workspace.yaml',
]
function productPorcelain() {
  return git(['status', '--porcelain', '--', ...PRODUCT_CLEAN_PATHS]).stdout
}
function git(args) {
  const out = spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { status: out.status, stdout: (out.stdout ?? '').trim(), stderr: (out.stderr ?? '').trim() }
}
function run(cmd, args, opts = {}) {
  const out = spawnSync(cmd, args, {
    cwd: REPO, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, ...(opts.env ?? {}) },
  })
  return { status: out.status, stdout: out.stdout ?? '', stderr: out.stderr ?? '' }
}
function tail(text, lines = 25) {
  return String(text ?? '').split('\n').slice(-lines).join('\n')
}
function listDir(path) {
  try { return readdirSync(path) } catch { return [] }
}

/** Bind-test one port on loopback. */
function portFree(port) {
  return new Promise((done) => {
    const server = createServer()
    server.once('error', () => done(false))
    server.once('listening', () => server.close(() => done(true)))
    server.listen(port, '127.0.0.1')
  })
}

/** Pick a FREE port inside the sanctioned test bands. Fixed ports are a shared
 *  resource on this machine (another lane can hold the one a driver assumed);
 *  a driver that hardcodes one turns a scheduling collision into a false
 *  product failure. Host band first, then the mock band. :3080 is never tried. */
async function pickSanctionedPort({ preferred = null, mock = false } = {}) {
  if (preferred !== null && isSanctionedTestPort(Number(preferred)) && await portFree(Number(preferred))) return Number(preferred)
  const ports = portsOfBands(mock ? MOCK_PORT_BANDS : HOST_PORT_BANDS)
  for (const port of ports) {
    // eslint-disable-next-line no-await-in-loop
    if (await portFree(port)) return port
  }
  throw new Error('no free port in the sanctioned test bands')
}

/** Content digest of a tree of files (sorted relative path + sha256). Used as
 *  the INSTALLED ARTIFACT IDENTITY: the host entry alone can be identical
 *  across two same-version tarballs whose other shipped files differ. */
function treeDigest(dir) {
  const rows = []
  const walk = (current, base) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) { walk(path, base); continue }
      if (!entry.isFile()) continue
      rows.push([relative(base, path).split('\\').join('/'), sha256File(path)])
    }
  }
  walk(dir, dir)
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return `sha256:${sha256Text(rows.map(([rel, sha]) => `${rel}\u0000${sha}`).join('\n'))}`
}

function tarballTreeDigest(tarball, label) {
  const dest = join(RUN_DIR, 'pack', `extract-${label}`)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  const r = spawnSync('tar', ['-xzf', tarball, '-C', dest], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) return null
  return treeDigest(join(dest, 'package'))
}

// ── phase 1: gates (versions, clean tree, rebuild, artifact freshness) ──────

function workspacePackageDirs() {
  // The workspace glob is `packages/*` (pnpm-workspace.yaml). Read it rather
  // than hardcode a package list: a new shipping package must be counted.
  const text = readFileSync(join(REPO, 'pnpm-workspace.yaml'), 'utf8')
  const dirs = []
  for (const line of text.split('\n')) {
    const m = /^\s*-\s*"([^"]+)"\s*$/u.exec(line) ?? /^\s*-\s*([^"#\s]+)\s*$/u.exec(line)
    if (m === null) continue
    const pattern = m[1].replace(/\/$/u, '')
    if (!pattern.includes('*')) continue
    const base = dirname(pattern)
    for (const entry of listDir(join(REPO, base))) {
      if (existsSync(join(REPO, base, entry, 'package.json'))) dirs.push(join(base, entry))
    }
  }
  return dirs
}

function phaseGates() {
  log('── GATES: version consistency, clean tree, rebuild, artifact freshness ──')
  const rootPkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
  const subPackages = workspacePackageDirs().map((rel) => {
    const pkg = JSON.parse(readFileSync(join(REPO, rel, 'package.json'), 'utf8'))
    return { path: rel, name: pkg.name, version: pkg.version, private: pkg.private === true }
  })
  const mismatched = subPackages.filter((p) => p.version !== rootPkg.version)
  const census = {
    root: { name: rootPkg.name, version: rootPkg.version },
    subPackages,
    mismatched,
    versions: [...new Set([rootPkg.version, ...subPackages.map((p) => p.version)])],
  }
  writeEvidence('gates/version-census.json', census)
  SUMMARY.gates.versionCensus = census
  check('VER-1', 'the root manifest is version 0.1.6', rootPkg.version === '0.1.6', `root=${rootPkg.version}`)
  check('VER-2', 'every shipping workspace package carries the SAME version as the root',
    mismatched.length === 0,
    `packages=${subPackages.length} mismatched=${JSON.stringify(mismatched.map((p) => `${p.path}=${p.version}`))}`)

  const headBefore = git(['rev-parse', 'HEAD'])
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout
  const porcelainBefore = git(['status', '--porcelain']).stdout
  const hostSha = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? null
  const hostPorcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout ?? ''
  const identity = {
    productSha: headBefore.stdout,
    branch,
    porcelainBefore,
    packedCommit: headBefore.stdout,
    hostPin: TEST_USE_BASELINE_SHA,
    hostVersion: DSH_BASELINE_VERSION,
    hostSha,
    hostPorcelain,
    testuse: TESTUSE,
    node: process.version,
    pnpm: run('pnpm', ['--version']).stdout.trim(),
    at: new Date().toISOString(),
    evidenceClass: 'DEV-LIVE',
  }
  identity.productPorcelainBefore = productPorcelain
  identity.fullPorcelainBefore = git(['status', '--porcelain']).stdout
  writeEvidence('gates/identity.json', identity)
  SUMMARY.gates.identity = identity
  const productPorcelainBefore = productPorcelain()
  const fullPorcelainBefore = git(['status', '--porcelain']).stdout
  check('PROV-1', 'the shipped product surface is clean (the pack will describe a commit, not a worktree)',
    productPorcelainBefore === '',
    `productPorcelain=${JSON.stringify(productPorcelainBefore)} fullPorcelain=${JSON.stringify(fullPorcelainBefore)}`)
  check('PROV-2', 'the pristine host checkout is the pin and byte-clean',
    hostSha === TEST_USE_BASELINE_SHA && hostPorcelain.trim() === '',
    `host=${String(hostSha)} pin=${TEST_USE_BASELINE_SHA} porcelain=${JSON.stringify(hostPorcelain.trim())}`)

  if (!FLAG_SKIP_REBUILD) {
    log('GATES: rebuilding (pnpm -r run build) …')
    const build = run('pnpm', ['-r', 'run', 'build'])
    writeEvidence('gates/build.log', `${build.stdout}\n--- stderr ---\n${build.stderr}`)
    check('ART-1', 'every workspace package rebuilds', build.status === 0,
      `exit=${build.status} tail=${JSON.stringify(tail(build.stderr, 8))}`)
    log('GATES: rebuilding composition (pnpm run build:composition) …')
    const comp = run('pnpm', ['run', 'build:composition'])
    writeEvidence('gates/build-composition.log', `${comp.stdout}\n--- stderr ---\n${comp.stderr}`)
    check('ART-2', 'the composition build (place-dist-glue + client bundle) succeeds', comp.status === 0,
      `exit=${comp.status} tail=${JSON.stringify(tail(comp.stderr, 8))}`)
    const porcelainAfter = productPorcelain()
    const headAfter = git(['rev-parse', 'HEAD']).stdout
    writeEvidence('gates/post-build.json', { porcelainAfter, headAfter, headBefore: headBefore.stdout })
    check('ART-3', 'the rebuild left NO product drift: the committed artifacts equal freshly built bytes (no stale dist)',
      porcelainAfter === '',
      `productPorcelain=${JSON.stringify(porcelainAfter)} fullPorcelain=${JSON.stringify(git(['status', '--porcelain']).stdout)}`)
    check('PROV-3', 'the rebuild did not move the commit being packed',
      headAfter === headBefore.stdout, `before=${headBefore.stdout} after=${headAfter}`)
    const artifactCheck = run('node', ['scripts/check-artifacts-committed.mjs'])
    writeEvidence('gates/check-artifacts-committed.log', `${artifactCheck.stdout}\n--- stderr ---\n${artifactCheck.stderr}`)
    const verdict = /DSH-ARTIFACT-VERDICT[^\n]*/u.exec(artifactCheck.stdout)?.[0] ?? null
    check('ART-4', 'node scripts/check-artifacts-committed.mjs reports verdict=ok',
      artifactCheck.status === 0 && verdict !== null && /verdict=ok/u.test(verdict),
      `exit=${artifactCheck.status} verdict=${String(verdict)}`)
    SUMMARY.gates.rebuild = { buildExit: build.status, compositionExit: comp.status, porcelainAfter, artifactVerdict: verdict }
  } else {
    log('GATES: rebuild SKIPPED (--skip-rebuild) — ART-1..ART-4 NOT MEASURED')
    SUMMARY.gates.rebuild = { skipped: true }
  }
  return rootPkg.version
}

// ── phase 2: pack + artifact identity + provenance ──────────────────────────

function tarballFacts(tarball) {
  const bytes = statSync(tarball).size
  const sha256 = sha256File(tarball)
  const listing = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
  const members = String(listing.stdout ?? '').split('\n').filter((line) => line !== '')
  const pkgOut = spawnSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const internalPackage = pkgOut.status === 0 ? JSON.parse(pkgOut.stdout) : null
  const hostEntryOut = spawnSync('tar', ['-xzOf', tarball,
    'package/packages/runtime/dist/packages/runtime/src/plugin/host.js'], { encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 })
  const hostEntrySha256 = hostEntryOut.status === 0 ? createHash('sha256').update(hostEntryOut.stdout).digest('hex') : null
  return { path: tarball, name: tarball.split('/').at(-1), bytes, sha256, memberCount: members.length, members, internalPackage, hostEntrySha256 }
}

function phasePack() {
  log('── PACK: pnpm pack, internal version, sha256, provenance ──')
  const packDir = join(RUN_DIR, 'pack')
  rmSync(packDir, { recursive: true, force: true })
  mkdirSync(packDir, { recursive: true })
  const head = git(['rev-parse', 'HEAD']).stdout
  const packedBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout
  const pnpmPack = run('pnpm', ['pack', '--pack-destination', packDir])
  writeEvidence('pack/pack.log', `${pnpmPack.stdout}\n--- stderr ---\n${pnpmPack.stderr}`)
  const tarballPath = join(packDir, `dsh-agent-team-0.1.6.tgz`)
  if (pnpmPack.status !== 0 || !existsSync(tarballPath)) {
    check('PACK-1', 'pnpm pack produced a tarball', false,
      `exit=${pnpmPack.status} expected=${tarballPath} stderr=${JSON.stringify(tail(pnpmPack.stderr, 15))}`)
    return null
  }
  const facts = tarballFacts(tarballPath)
  facts.treeDigest = tarballTreeDigest(tarballPath, 'packed')
  writeEvidence('pack/members.txt', facts.members.join('\n'))
  const required = [
    'package/package.json',
    'package/cordis.patch.yml',
    'package/packages/runtime/dist/packages/runtime/src/plugin/host.js',
    'package/packages/runtime/dist/packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py',
    'package/packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-governed-realm.mjs',
    'package/packages/client/composition-shim/index.js',
    'package/packages/runtime/root-binding/index.ts',
  ]
  const missing = required.filter((entry) => !facts.members.includes(entry))
  const provenance = {
    packedCommit: head,
    branch: packedBranch,
    cleanAtPack: productPorcelain() === '',
    productPorcelainAtPack: productPorcelain(),
    fullPorcelainAtPack: git(['status', '--porcelain']).stdout,
    tarballSha256: facts.sha256,
    tarballBytes: facts.bytes,
    internalVersion: facts.internalPackage?.version ?? null,
    internalName: facts.internalPackage?.name ?? null,
    hostPin: TEST_USE_BASELINE_SHA,
    hostVersion: DSH_BASELINE_VERSION,
    at: new Date().toISOString(),
  }
  writeEvidence('pack/provenance.json', provenance)
  writeEvidence('pack/internal-package.json', facts.internalPackage ?? {})
  SUMMARY.pack = {
    ...provenance, path: tarballPath, memberCount: facts.memberCount,
    requiredMembers: required, missingMembers: missing, hostEntrySha256: facts.hostEntrySha256,
    treeDigest: facts.treeDigest,
  }
  check('PACK-1', 'pnpm pack produced the 0.1.6 tarball', true,
    `bytes=${facts.bytes} members=${facts.memberCount} sha256=${facts.sha256}`)
  check('PACK-2', 'the tarball internal package.json names the SAME version',
    facts.internalPackage?.version === '0.1.6',
    `internal=${String(facts.internalPackage?.version)} file=${facts.name}`)
  check('PACK-3', 'the tarball carries the built install surface (host entry, governed realm, launcher, client shim)',
    missing.length === 0, `missing=${JSON.stringify(missing)}`)
  check('PACK-4', 'the packed provenance is the exact commit and the tree was clean at pack time',
    provenance.packedCommit.length === 40 && provenance.cleanAtPack,
    `commit=${provenance.packedCommit} clean=${String(provenance.cleanAtPack)}`)
  return tarballPath
}

// ── phase 3: clean-host install into a fresh dir + fresh DSH_HOME ──────────

function ensureFreshWorld() {
  if (existsSync(WORLD)) {
    throw new Error(`refusing to reuse an existing world: ${WORLD} (safe-to-re-run means a FRESH DSH_HOME; delete it first if it is stale)`)
  }
  mkdirSync(HOME, { recursive: true })
  mkdirSync(PROJECT, { recursive: true })
  mkdirSync(WS, { recursive: true })
  // The host CLI installs through pnpm; a workspace file keeps the store inside
  // the session workspace (the default store lives outside the write sandbox).
  mkdirSync(PROFILE, { recursive: true })
  writeFileSync(join(PROFILE, 'pnpm-workspace.yaml'), [
    'packages:', '  - .', '',
    'nodeLinker: hoisted',
    'autoInstallPeers: false',
    `storeDir: ${STORE_DIR}`,
    'strictDepBuilds: false',
    '',
  ].join('\n'))
}

function installTarball(tarball, label) {
  const out = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', tarball], {
    cwd: HOME,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, DSH_HOME: HOME, npm_config_store_dir: STORE_DIR },
  })
  writeEvidence(join(label, 'install-stdout.txt'), `${out.stdout ?? ''}\n--- stderr ---\n${out.stderr ?? ''}`)
  const profilePackagePath = join(PROFILE, 'package.json')
  const profilePackage = existsSync(profilePackagePath) ? JSON.parse(readFileSync(profilePackagePath, 'utf8')) : null
  const installedPackagePath = join(PROFILE, 'node_modules', 'dsh-agent-team', 'package.json')
  const installedPackage = existsSync(installedPackagePath) ? JSON.parse(readFileSync(installedPackagePath, 'utf8')) : null
  const installedHostEntry = join(PROFILE, 'node_modules', 'dsh-agent-team', 'packages', 'runtime', 'dist',
    'packages', 'runtime', 'src', 'plugin', 'host.js')
  const installedHostSha = existsSync(installedHostEntry) ? sha256File(installedHostEntry) : null
  const lockPath = join(PROFILE, 'pnpm-lock.yaml')
  const lock = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : ''
  const integrity = /integrity:\s*(sha512-[A-Za-z0-9+/=]+)/u.exec(lock)?.[1] ?? null
  const bundlePatch = join(PROFILE, 'node_modules', 'dsh-agent-team', 'cordis.patch.yml')
  const bundleText = existsSync(bundlePatch) ? readFileSync(bundlePatch, 'utf8') : ''
  const bundleRowUsesPackageName = /name:\s*"dsh-agent-team\/host"/u.test(bundleText)
  // The ONLY `file:` reference allowed in the profile is the TARBALL spec the
  // operator passed. Anything else pointing into the worktree is a leak.
  const worktreeRefs = []
  for (const rel of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml']) {
    const path = join(PROFILE, rel)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.includes(REPO)) continue
      if (line.includes(tarball)) continue
      worktreeRefs.push(`${rel}: ${line.trim()}`)
    }
  }
  const installedRoot = join(PROFILE, 'node_modules', 'dsh-agent-team')
  const installedTreeDigest = existsSync(installedRoot) ? treeDigest(installedRoot) : null
  const facts = {
    command: `DSH_HOME=${HOME} node ${HOST_BIN} plugin --profile web add ${tarball}`,
    exit: out.status,
    tarball,
    tarballSha256: sha256File(tarball),
    installedVersion: installedPackage?.version ?? null,
    installedName: installedPackage?.name ?? null,
    installedHostEntrySha256: installedHostSha,
    installedTreeDigest,
    profileDependency: profilePackage?.dependencies?.['dsh-agent-team'] ?? null,
    profileBundles: profilePackage?.dsh?.profile?.bundles ?? null,
    lockIntegrity: integrity,
    bundleRowUsesPackageName,
    worktreeRefsInProfile: worktreeRefs,
    freshWorld: WORLD,
    freshHome: HOME,
    freshProject: PROJECT,
  }
  writeEvidence(join(label, 'install-facts.json'), facts)
  if (profilePackage !== null) writeEvidence(join(label, 'profile-package.json'), profilePackage)
  if (installedPackage !== null) writeEvidence(join(label, 'installed-package.json'), installedPackage)
  return facts
}

function phaseInstall(tarball) {
  log('── INSTALL: fresh dir + fresh DSH_HOME, pinned host CLI ──')
  ensureFreshWorld()
  const facts = installTarball(tarball, 'install')
  SUMMARY.install = facts
  const packed = SUMMARY.pack
  check('INST-1', 'the pinned host CLI installed the tarball into a FRESH profile (no repo node_modules)',
    facts.exit === 0 && facts.installedVersion !== null,
    `exit=${facts.exit} installed=${String(facts.installedVersion)} world=${WORLD}`)
  check('INST-2', 'the installed package identifies the SAME version as the tarball internal package.json',
    facts.installedVersion === packed.internalVersion && facts.installedVersion === '0.1.6',
    `installed=${String(facts.installedVersion)} tarball=${String(packed.internalVersion)}`)
  check('INST-3', 'the installed host entry is byte-identical to the packed one (the artifact is what boots)',
    facts.installedHostEntrySha256 !== null && facts.installedHostEntrySha256 === packed.hostEntrySha256,
    `installed=${String(facts.installedHostEntrySha256)} packed=${String(packed.hostEntrySha256)}`)
  check('INST-4', 'the profile resolves the plugin by package name with a tarball integrity in the lock',
    facts.bundleRowUsesPackageName && typeof facts.lockIntegrity === 'string' && facts.lockIntegrity.startsWith('sha512-'),
    `bundleRow=${String(facts.bundleRowUsesPackageName)} integrity=${String(facts.lockIntegrity).slice(0, 24)}…`)
  check('INST-6', 'the WHOLE installed package tree is byte-identical to the packed tree (not just the host entry)',
    facts.installedTreeDigest !== null && facts.installedTreeDigest === packed.treeDigest,
    `installed=${String(facts.installedTreeDigest)} packed=${String(packed.treeDigest)}`)
  check('INST-5', 'no worktree source path leaked into the installed profile',
    facts.worktreeRefsInProfile.length === 0,
    `refs=${JSON.stringify(facts.worktreeRefsInProfile)}`)
  return facts
}

// ── phase 4: live Team/Member arm from the INSTALLED profile ───────────────

async function phaseLive(tarball) {
  log('── LIVE: installed tarball → real Host → v5 Team (both families) → Member → execute ──')
  const childRunDir = join(RUN_DIR, 'live')
  // 13060/13080 are inside `tests/paths.mjs` TEST_PORT_RANGES (host band
  // 13000-13049, mock band 13050-13099) — the 140xx family the older packaged
  // instrument defaulted to is OUTSIDE policy, so this driver passes explicit
  // sanctioned ports instead of inheriting that default.
  // 130xx is inside `tests/paths.mjs` TEST_PORT_RANGES (host band 13000-13049,
  // mock band 13050-13099); the 140xx family the older packaged instrument
  // defaulted to is OUTSIDE policy. Ports are picked FREE at run time — a fixed
  // port turns another lane's lease into a false product failure.
  const hostPort = String(await pickSanctionedPort({ preferred: HOST_PORT_ARG, mock: false }))
  const mockPort = String(await pickSanctionedPort({ preferred: MOCK_PORT_ARG, mock: true }))
  for (const [name, value] of [['host', hostPort], ['mock', mockPort]]) {
    if (!isSanctionedTestPort(Number(value))) {
      check('LIVE-0', `the ${name} port is inside the sanctioned test bands and is not :3080`, false, `port=${value}`)
      return null
    }
  }
  check('LIVE-0', 'the Host and mock ports are free and inside the sanctioned test bands', true,
    `host=${hostPort} mock=${mockPort}`)
  const instrument = join(REPO, 'tests', 'kits', 'v016-packaged-acceptance', 'run-packaged-acceptance.mjs')
  const instrumentSha = sha256File(instrument)
  writeEvidence('live/instrument.json', {
    path: relative(REPO, instrument), sha256: instrumentSha,
    flags: ['--member-io-ceilings', '--keep', '--tarball', '--evidence-dir'],
    note: 'The proven packaged-acceptance instrument drives the live arm. Its default (no --member-io-ceilings) evidence is unchanged; this run passes the opt-in ceiling family.',
  })
  SUMMARY.live = { instrument: relative(REPO, instrument), instrumentSha256: instrumentSha, hostPort, mockPort }
  const homesBefore = new Set(listDir(join(REPO, 'tests', 'homes')))
  const child = spawnSync(process.execPath, [instrument,
    '--run', RUN, '--port', hostPort, '--mock-port', mockPort, '--keep',
    '--member-io-ceilings', '--tarball', tarball, '--evidence-dir', childRunDir,
  ], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, V016_EXPECT_CANDIDATE_SHA: SUMMARY.pack.packedCommit },
  })
  writeEvidence('live/instrument-stdout.txt', `${child.stdout ?? ''}\n--- stderr ---\n${child.stderr ?? ''}`)
  const summaryPath = join(childRunDir, 'summary.json')
  let instrumentSummary = null
  try { instrumentSummary = JSON.parse(readFileSync(summaryPath, 'utf8')) } catch { instrumentSummary = null }
  SUMMARY.live.instrumentExit = child.status
  SUMMARY.live.instrumentOk = instrumentSummary?.ok === true
  SUMMARY.live.instrumentChecks = instrumentSummary?.checks ?? null
  SUMMARY.live.typedSurfaces = instrumentSummary?.flow?.typedSurfaces ?? null
  SUMMARY.live.team = instrumentSummary?.flow?.team ?? null
  SUMMARY.live.member = instrumentSummary?.flow?.member ?? null
  const failedChecks = (instrumentSummary?.checks ?? []).filter((row) => row.ok !== true)
  check('LIVE-1', 'the proven packaged instrument runs to completion on the INSTALLED artifact',
    child.status === 0 && instrumentSummary?.ok === true,
    `exit=${child.status} checks=${instrumentSummary === null ? 'unreadable' : `${instrumentSummary.checks.filter((c) => c.ok).length}/${instrumentSummary.checks.length}`} failed=${JSON.stringify(failedChecks.map((c) => c.id))}`)
  const surfaces = instrumentSummary?.flow?.typedSurfaces ?? null
  check('LIVE-2', 'the durable v5 blueprint froze BOTH families (memberIoCeilings + reviewRouting) — typed surface read from the registry row',
    surfaces?.frozenDocumentSchemaVersion === 5 && surfaces?.frozenHasMemberIoCeilings === true && surfaces?.frozenHasReviewRouting === true,
    `schemaVersion=${String(surfaces?.frozenDocumentSchemaVersion)} memberIoCeilings=${String(surfaces?.frozenHasMemberIoCeilings)} reviewRouting=${String(surfaces?.frozenHasReviewRouting)} contentHash=${String(surfaces?.registryContentHash)}`)
  check('LIVE-3', 'a real Member turn executed through the installed artifact and the result was collected',
    instrumentSummary?.flow?.member?.workerDurable === true && (instrumentSummary?.checks ?? []).some((c) => c.id === 'COLL-1' && c.ok === true),
    `worker=${String(instrumentSummary?.flow?.member?.workerInstanceId)} durable=${String(instrumentSummary?.flow?.member?.workerDurable)} COLL-1=${String((instrumentSummary?.checks ?? []).find((c) => c.id === 'COLL-1')?.ok)}`)
  const world = instrumentSummary?.teardown?.world ?? null
  const newHomes = listDir(join(REPO, 'tests', 'homes')).filter((entry) => !homesBefore.has(entry) && entry.startsWith(`v016-pack-${RUN}-`))
  SUMMARY.live.world = world
  SUMMARY.live.worlds = [world, ...newHomes.map((entry) => join(REPO, 'tests', 'homes', entry))].filter(Boolean)
  return instrumentSummary
}

// ── phase 5: upgrade + rollback (no invented protocol) ─────────────────────

function durableSnapshot(root) {
  // Every durable byte under the world (storages/sessions/...), excluding logs
  // and the installed profile. A plugin install must not rewrite these.
  const out = {}
  const walk = (dir, base) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      const rel = relative(base, path)
      if (entry.isDirectory()) { walk(path, base); continue }
      if (!entry.isFile()) continue
      if (/\.(?:log|lock)$/u.test(entry.name)) continue
      try { out[rel] = sha256File(path) } catch { /* unreadable */ }
    }
  }
  for (const sub of ['storages', 'sessions', 'workspace', 'blueprints', 'alpha6-wake-intents']) walk(join(root, sub), root)
  return out
}

async function bootAndReadTeam(world, label, hostPort, mockPort, teamRoot) {
  const instanceLog = join(RUN_DIR, label, 'instance.log')
  mkdirSync(dirname(instanceLog), { recursive: true })
  const mock = await startMockModel({
    port: Number(mockPort),
    decide: () => ({ kind: 'text', content: `${label}_ACK` }),
    log: (line) => log(`mock[${label}]: ${line}`),
  })
  const out = openSync(instanceLog, 'a')
  const err = openSync(instanceLog, 'a')
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(hostPort), '--no-open'], {
      cwd: join(world, 'workspace'),
      stdio: ['ignore', out, err],
      env: {
        ...process.env,
        DSH_HOME: join(world, 'home'),
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
        DEEPSEEK_API_KEY: `${label}-mock-key`,
      },
    })
  } finally {
    closeSync(out); closeSync(err)
  }
  const result = { label, hostPort, mockPort, booted: false, authStatus: null, projectionStatus: null, teamReadable: false, error: null, instanceLog }
  try {
    const deadline = Date.now() + 240_000
    let url = null
    while (Date.now() < deadline) {
      const text = existsSync(instanceLog) ? readFileSync(instanceLog, 'utf8') : ''
      const all = [...text.matchAll(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/gu)]
      if (all.length > 0) { url = all.at(-1)[1]; break }
      if (child.exitCode !== null) break
      // eslint-disable-next-line no-await-in-loop
      await sleep(400)
    }
    if (url === null) throw new Error(`no boot line in 240s; log tail:\n${tail(existsSync(instanceLog) ? readFileSync(instanceLog, 'utf8') : '', 25)}`)
    result.booted = true
    const auth = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    result.authStatus = auth.status
    const cookie = (auth.headers.get('set-cookie') ?? '').split(';', 1)[0]
    const origin = url.replace(/\/\?token=.*$/u, '')
    if (teamRoot !== null) {
      const rpc = await fetch(`${origin}/team-remote/team.getProjection`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          type: 'client-request', rpcId: `${label}-proj`, method: 'team.getProjection',
          payload: { version: 4, params: { teamSessionId: teamRoot } },
        }),
        signal: AbortSignal.timeout(60_000),
      })
      result.projectionStatus = rpc.status
      const body = await rpc.json().catch(() => null)
      const projection = body?.result?.value?.data?.projection ?? body?.result?.value ?? null
      result.teamReadable = rpc.status === 200 && body?.result?.ok === true && projection !== null
      result.projectionMembers = (projection?.members ?? []).length
    }
  } catch (error) {
    result.error = String(error?.message ?? error)
  } finally {
    try { child?.kill('SIGKILL') } catch { /* gone */ }
    await sleep(800)
    try { await mock.close?.() } catch { /* closed */ }
  }
  writeEvidence(join(label, 'boot.json'), result)
  return result
}

async function phaseUpgrade(teamRoot, upgradePorts) {
  log('── UPGRADE / ROLLBACK: second tarball over the installation, then back ──')
  if (SECOND_TARBALL_ARG === null) {
    check('UPG-0', 'a second tarball was supplied for the upgrade measurement', false,
      'no --second-tarball; the upgrade/rollback finding is NOT MEASURED')
    return
  }
  const second = resolve(SECOND_TARBALL_ARG)
  const world = SUMMARY.live.world ?? WORLD
  const homeBefore = join(world, 'home')
  const dataBefore = durableSnapshot(world)
  const before = installFactsOnly()
  writeEvidence('upgrade/data-before.json', { count: Object.keys(dataBefore).length, files: dataBefore })

  const secondFacts = tarballFacts(second)
  secondFacts.treeDigest = tarballTreeDigest(second, 'second')
  writeEvidence('upgrade/second-tarball.json', {
    ...secondFacts, internalPackage: secondFacts.internalPackage, members: undefined,
    secondCommit: SECOND_COMMIT_ARG,
  })
  const upgraded = installTarball(second, 'upgrade')
  const dataAfterUpgrade = durableSnapshot(world)
  const dataSameUpgrade = JSON.stringify(dataBefore) === JSON.stringify(dataAfterUpgrade)
  writeEvidence('upgrade/data-after.json', { count: Object.keys(dataAfterUpgrade).length, files: dataAfterUpgrade })
  SUMMARY.upgrade = {
    secondTarball: second, secondSha256: secondFacts.sha256, secondBytes: secondFacts.bytes,
    secondTreeDigest: secondFacts.treeDigest, firstTreeDigest: SUMMARY.pack.treeDigest,
    installedTreeDigestAfterSwap: upgraded.installedTreeDigest,
    secondInternalVersion: secondFacts.internalPackage?.version ?? null, secondCommit: SECOND_COMMIT_ARG,
    exit: upgraded.exit, installedVersionBefore: before.installedVersion, installedVersionAfter: upgraded.installedVersion,
    hostEntryBefore: before.installedHostEntrySha256, hostEntryAfter: upgraded.installedHostEntrySha256,
    secondHostEntry: secondFacts.hostEntrySha256, dataFilesBefore: Object.keys(dataBefore).length,
    dataFilesAfter: Object.keys(dataAfterUpgrade).length, dataUnchanged: dataSameUpgrade,
  }
  check('UPG-1', 'the second tarball installs over the existing installation (the only upgrade primitive the product has)',
    upgraded.exit === 0, `exit=${upgraded.exit} second=${secondFacts.sha256}`)
  const swapped = upgraded.installedTreeDigest === secondFacts.treeDigest
    && secondFacts.treeDigest !== SUMMARY.pack.treeDigest
  check('UPG-2', 'the installed artifact identity became the second tarball TREE (observed, not assumed; same version, different bytes)',
    swapped,
    `installedTree=${String(upgraded.installedTreeDigest)} secondTree=${String(secondFacts.treeDigest)} firstTree=${String(SUMMARY.pack.treeDigest)} sameVersion=${String(upgraded.installedVersion === before.installedVersion)}`)
  check('UPG-3', 'the plugin install did NOT touch durable world data (no migration step exists to run)',
    dataSameUpgrade, `files=${Object.keys(dataBefore).length}→${Object.keys(dataAfterUpgrade).length} identical=${String(dataSameUpgrade)}`)
  const bootUpgraded = await bootAndReadTeam(world, 'upgrade', upgradePorts.upgradeHost, upgradePorts.upgradeMock, teamRoot)
  SUMMARY.upgrade.boot = bootUpgraded
  check('UPG-4', 'a Host booted on the second artifact still reads the existing durable Team',
    bootUpgraded.booted === true && bootUpgraded.teamReadable === true,
    `booted=${String(bootUpgraded.booted)} auth=${String(bootUpgraded.authStatus)} projection=${String(bootUpgraded.projectionStatus)} readable=${String(bootUpgraded.teamReadable)} error=${String(bootUpgraded.error)}`)

  log('── ROLLBACK: re-install the first tarball ──')
  const dataBeforeRollback = durableSnapshot(world)
  writeEvidence('rollback/data-before.json', { count: Object.keys(dataBeforeRollback).length, files: dataBeforeRollback })
  const firstTarball = SUMMARY.pack.path
  const rolled = installTarball(firstTarball, 'rollback')
  const dataAfterRollback = durableSnapshot(world)
  const dataSameRollback = JSON.stringify(dataBeforeRollback) === JSON.stringify(dataAfterRollback)
  // Survival is a DIFFERENT question from "unchanged by the swap": every file
  // present before the swap must still be present after rollback.
  const survived = Object.keys(dataBefore).every((rel) => Object.prototype.hasOwnProperty.call(dataAfterRollback, rel))
  writeEvidence('rollback/data-after.json', { count: Object.keys(dataAfterRollback).length, files: dataAfterRollback })
  SUMMARY.rollback = {
    tarball: firstTarball, exit: rolled.exit, installedVersion: rolled.installedVersion,
    hostEntry: rolled.installedHostEntrySha256, expectedHostEntry: SUMMARY.pack.hostEntrySha256,
    dataUnchanged: dataSameRollback,
  }
  check('RBK-1', 'rolling back is re-installing the first tarball, and it succeeds', rolled.exit === 0, `exit=${rolled.exit}`)
  check('RBK-2', 'the installed artifact identity returned to the first tarball byte-for-byte',
    rolled.installedTreeDigest === SUMMARY.pack.treeDigest,
    `installedTree=${String(rolled.installedTreeDigest)} firstTree=${String(SUMMARY.pack.treeDigest)}`)
  check('RBK-3', 'the rollback install did not rewrite durable world data, and every pre-swap durable file survived',
    dataSameRollback && survived,
    `files=${Object.keys(dataAfterRollback).length} installRewroteData=${String(!dataSameRollback)} allPreSwapFilesPresent=${String(survived)}`)
  const bootRolled = await bootAndReadTeam(world, 'rollback', upgradePorts.rollbackHost, upgradePorts.rollbackMock, teamRoot)
  SUMMARY.rollback.boot = bootRolled
  check('RBK-4', 'a Host booted after rollback reads the same durable Team',
    bootRolled.booted === true && bootRolled.teamReadable === true,
    `booted=${String(bootRolled.booted)} auth=${String(bootRolled.authStatus)} projection=${String(bootRolled.projectionStatus)} readable=${String(bootRolled.teamReadable)} error=${String(bootRolled.error)}`)
  // The honest limit: there is no version negotiation, so an OLDER artifact may
  // read newer data without any guarantee. Record what was observed instead.
  SUMMARY.upgrade.dataUnchangedAcrossAll = dataSameUpgrade && dataSameRollback && survived
  SUMMARY.rollback.dataSurvivedFromBeforeSwap = survived
  return { world, homeBefore }
}

function installFactsOnly() {
  const installedPackagePath = join(PROFILE, 'node_modules', 'dsh-agent-team', 'package.json')
  const installedPackage = existsSync(installedPackagePath) ? JSON.parse(readFileSync(installedPackagePath, 'utf8')) : null
  const hostEntry = join(PROFILE, 'node_modules', 'dsh-agent-team', 'packages', 'runtime', 'dist',
    'packages', 'runtime', 'src', 'plugin', 'host.js')
  return {
    installedVersion: installedPackage?.version ?? null,
    installedHostEntrySha256: existsSync(hostEntry) ? sha256File(hostEntry) : null,
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  log(`packaging-v016 lane — run ${RUN} — phase=${PHASE}`)
  log(`worktree=${REPO}`)
  log(`testuse=${TESTUSE}`)
  log(`evidence=${RUN_DIR}`)
  log(`world=${WORLD}`)
  if (!existsSync(HOST_BIN)) {
    check('ENV-1', 'the pinned pristine host build entry exists', false, HOST_BIN)
    finish(1)
    return
  }
  check('ENV-1', 'the pinned pristine host build entry exists', true, HOST_BIN)

  let tarball = null
  if (['all', 'gates', 'pack'].includes(PHASE)) phaseGates()
  if (TARBALL_ARG !== null) {
    tarball = resolve(TARBALL_ARG)
    if (!existsSync(tarball)) throw new Error(`--tarball does not exist: ${tarball}`)
    const reused = tarballFacts(tarball)
    writeEvidence('pack/reused-tarball.json', { ...reused, members: undefined, note: 'reused --tarball; the pack step was NOT re-run' })
    SUMMARY.pack = {
      mode: 'reused', path: tarball, packedCommit: git(['rev-parse', 'HEAD']).stdout,
      tarballSha256: reused.sha256, tarballBytes: reused.bytes,
      internalVersion: reused.internalPackage?.version ?? null,
      internalName: reused.internalPackage?.name ?? null,
      memberCount: reused.memberCount, hostEntrySha256: reused.hostEntrySha256,
    }
    check('PACK-0', 'a pre-built tarball was supplied (pack recorded as REUSED, never claimed as this run\'s pack)',
      reused.internalPackage !== null, `tarball=${tarball} sha256=${reused.sha256}`)
  } else if (['all', 'pack'].includes(PHASE)) {
    tarball = phasePack()
  }
  if (['all', 'install'].includes(PHASE) && tarball !== null) phaseInstall(tarball)
  let liveSummary = null
  if (['all', 'live'].includes(PHASE) && tarball !== null && !FLAG_SKIP_LIVE) {
    liveSummary = await phaseLive(tarball)
  }
  if (PHASE === 'all' && !FLAG_SKIP_UPGRADE) {
    const teamRoot = liveSummary?.flow?.team?.teamSessionId ?? null
    const upgradePorts = {
      upgradeHost: await pickSanctionedPort({ mock: false }),
      upgradeMock: await pickSanctionedPort({ mock: true }),
    }
    // never collide with the live arm's still-released ports
    await phaseUpgrade(teamRoot, upgradePorts)
  }

  // Teardown by path (the driver owns the worlds it created). The live
  // instrument's world is kept by --keep so upgrade could use it; remove it now
  // unless the operator asked to keep the evidence world.
  const liveWorlds = (SUMMARY.live.worlds ?? [SUMMARY.live.world]).filter((d) => typeof d === 'string' && d !== '')
  const finalHostPorcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout ?? ''
  check('HYG-1', 'the pristine host checkout stayed byte-clean', finalHostPorcelain.trim() === '',
    `porcelain=${JSON.stringify(finalHostPorcelain.trim())}`)
  if (!FLAG_KEEP) {
    for (const dir of [WORLD, ...liveWorlds]) {
      rmSync(dir, { recursive: true, force: true })
      log(`teardown: world removed (${dir})`)
    }
    SUMMARY.teardown = { kept: false, worlds: [WORLD, ...liveWorlds] }
  } else {
    log(`teardown: worlds KEPT (${[WORLD, ...liveWorlds].join(', ')})`)
    SUMMARY.teardown = { kept: true, worlds: [WORLD, ...liveWorlds] }
  }
  // The tarball is identity, never committed (4.4 MB binary).
  writeEvidence('.gitignore', '*.tgz\npack/*.tgz\n')
  finish(CHECKS.some((row) => !row.ok) ? 2 : 0)
}

function finish(code) {
  const summary = {
    ...SUMMARY,
    at: new Date().toISOString(),
    ok: code === 0,
    exitCode: code,
    checks: CHECKS,
  }
  writeEvidence('summary.json', summary)
  log(`RESULT ${code === 0 ? 'PASS' : code === 2 ? 'FAIL' : 'FATAL'} checks=${CHECKS.filter((c) => c.ok).length}/${CHECKS.length}`)
  setTimeout(() => process.exit(code), 50)
}

main().catch((error) => {
  log(`FATAL ${String(error?.stack ?? error)}`)
  try {
    const liveWorlds = (SUMMARY.live.worlds ?? [SUMMARY.live.world]).filter(Boolean)
    if (!FLAG_KEEP) {
      for (const dir of [WORLD, ...liveWorlds]) rmSync(dir, { recursive: true, force: true })
    }
  } catch { /* best effort */ }
  writeEvidence('fatal.json', { message: String(error?.message ?? error), checks: CHECKS })
  finish(1)
})
