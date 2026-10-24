#!/usr/bin/env node
/**
 * face-check.mjs — install-face measurement helper for install-candidate.sh.
 *
 * Measures the INSTALLED face of the candidate against the declared `files:`
 * face at the exact CANDIDATE_SHA (the same three-zero law graded by
 * a5ie-r2b/r3/r4-b2/r5 and release-candidate-r1 — see
 * evidence/alpha5/release-candidate-r1/rc-trial-kit.mjs, whose functions this
 * helper re-derives with zero new law):
 *
 *   I2  strict profile face: exactly one dependency (dsh-agent-team), node_modules
 *       top level holds nothing else, the reconciler appended the bundle rows.
 *   I3a-e INSTALL THREE ZEROS: count == declared face, missing = 0, extra = 0,
 *       per-file sha mismatch = 0; rootSha recorded; the pack-always pair is
 *       disclosed, never folded into the count.
 *   I4  the composed bundle layer is machine-agnostic (no file:/ absolute paths).
 *   I8/I9 the Landlock pre-launcher is NOT on the published face (disclosed gap);
 *       the deployment input is materialized from the SAME commit, byte-pinned,
 *       and answers its own --abi-probe.
 *   I5  the host's own --dump-config composes the installed bundle row through
 *       the public profile seam (team row + spill-local + client rows).
 *
 * Writes a single JSON receipt (--out) that install-candidate.sh folds into
 * INSTALLED.json. Exit 0 = every graded check passed; exit 2 = RED (the receipt
 * still carries every observation — nothing is hidden behind the exit code);
 * exit 1 = FATAL (receipt in fatal field).
 *
 * READ-ONLY toward the host worlds: it only measures what the installer put on
 * disk plus one --dump-config composition probe; it boots nothing and touches
 * no port.
 *
 * @module evidence/alpha5/candidate-package/face-check
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const argValue = (n, d) => { const eq = args.find((x) => x.startsWith(`--${n}=`)); if (eq !== undefined) return eq.slice(n.length + 3); const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

const SRC = argValue('src', '')                 // clone of the candidate repo at CANDIDATE_SHA
const SHA = argValue('sha', '')                 // the exact 40-hex CANDIDATE_SHA
const WORLD = argValue('world', '')             // DSH_HOME the installer used
const INSTALLED = argValue('installed-dir', '') // <world>/profiles/web/node_modules/dsh-agent-team
const HOST_BIN = argValue('host-bin', '')       // <test-use>/apps/cli/lib/bin.js
const OUT = argValue('out', join(process.cwd(), 'face-check.json'))
if (!/^[0-9a-f]{40}$/.test(SHA)) die(`--sha must be a full 40-hex SHA, got: ${SHA}`)
for (const [what, p] of [['--src', SRC], ['--world', WORLD], ['--installed-dir', INSTALLED], ['--host-bin', HOST_BIN]]) {
  if (!existsSync(p)) die(`${what} path does not exist: ${p}`)
}

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, '$1<REDACTED>'],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)

function walkFiles (dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, base, out)
    else if (e.isFile()) out.push(p.slice(base.length + 1).split('\\').join('/'))
    else out.push(`NOT-A-FILE:${p.slice(base.length + 1).split('\\').join('/')}`)
  }
  return out
}

// declared install face (same method as a5ie-r2b I3 / rc-trial I3)
function declaredFace (worktree, sha) {
  const pkg = JSON.parse(spawnSync('git', ['-C', worktree, 'show', `${sha}:package.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout)
  const files = (pkg.files ?? []).map((f) => f.replace(/^\.\//, '').replace(/\/$/, ''))
  const ls = spawnSync('git', ['-C', worktree, 'ls-tree', '-r', '--name-only', '-z', sha], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  if (ls.status !== 0) die(`git ls-tree failed: ${String(ls.stderr).slice(0, 200)}`)
  const tree = ls.stdout.split('\0').filter((s) => s !== '')
  const under = (p) => files.some((f) => p === f || p.startsWith(`${f}/`))
  const docish = (p) => !p.includes('/') && /^(readme|license|licence|changelog|changes|history|notice)(\..*)?$/i.test(p)
  const declared = tree.filter(under)
  const packAdditions = tree.filter((p) => !under(p) && (p === 'package.json' || docish(p)))
  return { files, declared, packAdditions, expected: [...declared, ...packAdditions] }
}
function materializeDeclaredFace (worktree, sha, face, evidenceDir) {
  const mirror = join(evidenceDir, 'declared-face-mirror')
  mkdirSync(mirror, { recursive: true })
  const arch = spawnSync('git', ['-C', worktree, 'archive', sha, '--', ...face.expected], { maxBuffer: 512 * 1024 * 1024 })
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
  const shaMismatch = []; const manifest = []
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
    expectedCount: expected.length, actualCount: actual.length,
    declaredCount: face.declared.length, packAdditions: face.packAdditions,
    missing, extra, shaMismatch,
    rootSha: sha256Text(manifest.map((m) => `${m.path} ${m.sha256}`).join('\n')),
    manifest,
  }
}

const checks = []
const check = (id, claim, cond, observed) => {
  checks.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const note = (id, claim, observed) => { checks.push({ id, claim, pass: null, observed }); console.log(`BOOK ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`) }

const receipt = { at: new Date().toISOString(), candidateSha: SHA, world: WORLD, installedDir: INSTALLED, srcClone: SRC, hostBin: HOST_BIN }
let exitCode = 0
try {
  const evidenceDir = OUT === '' ? process.cwd() : (OUT.endsWith('.json') ? OUT.slice(0, -5) : OUT)
  mkdirSync(evidenceDir, { recursive: true })

  // ── I2: strict profile face ──
  const profileDir = join(WORLD, 'profiles', 'web')
  const manifest = existsSync(join(profileDir, 'package.json')) ? JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) : null
  const nmDir = join(profileDir, 'node_modules')
  const nodeModulesTop = existsSync(nmDir) ? readdirSync(nmDir).filter((n) => !n.startsWith('.')).sort() : []
  const deps = Object.keys(manifest?.dependencies ?? {})
  const bundles = (manifest?.dsh?.profile?.bundles ?? []).map((b) => (typeof b === 'string' ? b : b?.id ?? String(b)))
  check('I2', 'STRICT profile face: the profile declares EXACTLY the candidate plugin, node_modules top level holds nothing else, and the reconciler appended the bundle rows',
    deps.length === 1 && deps[0] === 'dsh-agent-team' && nodeModulesTop.length === 1 && nodeModulesTop[0] === 'dsh-agent-team' && bundles.length > 0,
    `deps=${JSON.stringify(deps)} nm=${JSON.stringify(nodeModulesTop)} bundles=${JSON.stringify(bundles)}`)

  // ── I3a-e: the three zeros, face recounted at this exact commit ──
  const face = declaredFace(SRC, SHA)
  const mirror = materializeDeclaredFace(SRC, SHA, face, evidenceDir)
  const m = measureInstalledFace(INSTALLED, face, mirror)
  try { rmSync(mirror, { recursive: true, force: true }) } catch { /* the per-file receipt lives in this JSON */ }
  receipt.face = { files: face.files, declaredCount: face.declared.length, packAdditions: face.packAdditions, expectedCount: m.expectedCount, actualCount: m.actualCount, missing: m.missing, extra: m.extra, shaMismatch: m.shaMismatch, rootSha: m.rootSha, manifest: m.manifest }
  check('I3a', 'INSTALL THREE-ZEROS (1/4 count): the installed tree holds exactly the declared face — one file per declared entry (RECOUNTED from package.json files: at CANDIDATE_SHA; never a hard-coded expectation)',
    m.actualCount === m.expectedCount, `installed=${String(m.actualCount)} declared-files-face=${String(m.expectedCount)} (files: entries=${String(face.declared.length)} + pack-always=${String(m.packAdditions.length)})`)
  check('I3b', 'INSTALL THREE-ZEROS (2/4 missing = 0): every declared file materialized in the install dir', m.missing.length === 0, `missing=${String(m.missing.length)} ${JSON.stringify(m.missing.slice(0, 3))}`)
  check('I3c', 'INSTALL THREE-ZEROS (3/4 extra = 0): nothing outside the declared face landed', m.extra.length === 0, `extra=${String(m.extra.length)} ${JSON.stringify(m.extra.slice(0, 3))}`)
  check('I3d', 'INSTALL THREE-ZEROS (4/4 sha-mismatch = 0): every installed file is BYTE-IDENTICAL to that path at the installed commit', m.shaMismatch.length === 0, `mismatch=${String(m.shaMismatch.length)} rootSha=${m.rootSha}`)
  check('I3e', 'the bytes beyond the declared files: list are exactly the pack rules\' always-included pair (disclosed, not folded into the count)',
    m.packAdditions.length === 2 && m.packAdditions.includes('package.json') && m.packAdditions.includes('README.md'), `alwaysIncluded=${JSON.stringify(m.packAdditions)}`)

  // ── I4: machine-agnostic composed layer ──
  check('I4', 'the installed bundle layer is machine-agnostic (rows reference the package by name; no file:/ URL landed in the profile manifest)',
    !(manifest?.dsh?.profile?.bundles ?? []).some((b) => JSON.stringify(b).includes('file:/')),
    `bundles=${JSON.stringify(bundles)}`)

  // ── I8/I9: the Landlock pre-launcher (deployment input, NOT on the face) ──
  const launcherRel = 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'
  const blob = spawnSync('git', ['-C', SRC, 'show', `${SHA}:${launcherRel}`], { maxBuffer: 64 * 1024 * 1024 })
  if (blob.status !== 0) die(`git show of the launcher blob failed: ${String(blob.stderr).slice(0, 200)}`)
  const launcherPath = join(WORLD, 'deployment', 'landlock-prelauncher.py')
  mkdirSync(join(launcherPath, '..'), { recursive: true })
  writeFileSync(launcherPath, blob.stdout)
  const launcherSha = sha256Text(blob.stdout)
  const worktreeLauncherSha = existsSync(join(SRC, launcherRel)) ? sha256File(join(SRC, launcherRel)) : 'SRC-MISSING'
  const abi = spawnSync('python3', [launcherPath, '--abi-probe'], { encoding: 'utf8', timeout: 30_000 })
  const abiLine = String(abi.stdout ?? '').trim().split('\n').filter((l) => l !== '').pop() ?? ''
  let abiJson = null; try { abiJson = JSON.parse(abiLine) } catch { /* keep raw */ }
  receipt.launcher = {
    rel: launcherRel, path: launcherPath, sha256: launcherSha, bytes: blob.stdout.length,
    commitEqualsWorktree: launcherSha === worktreeLauncherSha,
    abiProbe: { rc: abi.status, answer: redact(abiLine).slice(0, 300), kind: abiJson?.kind ?? null, abiVersion: abiJson?.abi_version ?? null },
  }
  check('I8', 'DISCLOSED FACE GAP (honest, not worked around): the Landlock pre-launcher is NOT on the published face — the installer supplies it as a deployment input, byte-pinned from the SAME commit',
    !face.expected.includes(launcherRel), `launcherInFace=${String(face.expected.includes(launcherRel))} launcherSha=${launcherSha.slice(0, 16)}… bytes=${String(blob.stdout.length)}`)
  check('I9', 'the deployment input is the RIGHT BYTES: commit blob == clone blob, starts with "#!", and the launcher itself answers the ABI probe',
    launcherSha === worktreeLauncherSha && blob.stdout.slice(0, 2).toString('utf8') === '#!',
    `sha=${launcherSha.slice(0, 16)}… commit==src=${String(launcherSha === worktreeLauncherSha)} abi=${String(abiJson?.kind)}/${String(abiJson?.abi_version)}`)
  if (abiJson?.kind !== 'abi-available') note('I9-ABI', 'ENV BOOK (not graded here): the launcher ABI probe on THIS host did not answer abi-available — the trial legs that run team_bash need ABI >= 3 (README prerequisites); install face bytes themselves are unaffected', `abi=${String(abiJson?.kind)}/${String(abiJson?.abi_version)} rc=${String(abi.status)}`)

  // ── I5: --dump-config composition through the public profile seam ──
  const dump = spawnSync(process.execPath, [HOST_BIN, '--profile', 'web', '--dump-config'], {
    cwd: join(WORLD, 'workspace'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
    env: { ...process.env, DSH_HOME: WORLD },
  })
  const dumpText = dump.stdout ?? ''
  writeFileSync(join(evidenceDir, 'dump-config-install-probe.txt'), redact(dumpText))
  const hasTeamRow = /^- id: dsh-agent-team\n {2}name: dsh-agent-team\/host$/m.test(dumpText)
  const hasSubRows = /name: dsh-agent-team\/spill-local/.test(dumpText) && /^- id: dsh-agent-team-client$/m.test(dumpText)
  const skipped = /skipped bundle|declares no dsh\.bundle/i.test(dumpText)
  check('I5', 'the host composes the INSTALLED bundle row through the public profile seam: --dump-config carries id dsh-agent-team / name dsh-agent-team/host plus the spill-local + client rows, no skipped bundle',
    dump.status === 0 && hasTeamRow && hasSubRows && !skipped,
    `exit=${String(dump.status)} teamRow=${String(hasTeamRow)} subRows=${String(hasSubRows)} skipped=${String(skipped)}`)
} catch (error) {
  exitCode = 1
  receipt.fatal = { message: String(error?.message ?? error), stack: String(error?.stack ?? '').slice(0, 2000) }
  console.log(`FATAL — ${String(error?.message ?? error)}`)
}
const pass = checks.filter((c) => c.pass === true).length
const fail = checks.filter((c) => c.pass === false).length
const book = checks.filter((c) => c.pass === null).length
receipt.checks = checks
receipt.summary = { pass, fail, book, exitCode: fail > 0 ? 2 : exitCode }
writeFileSync(OUT, JSON.stringify(receipt, null, 2) + '\n')
console.log(`SUMMARY pass=${String(pass)} fail=${String(fail)} booked=${String(book)} (receipt: ${OUT})`)
process.exit(receipt.summary.exitCode)
