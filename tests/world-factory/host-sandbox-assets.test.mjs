/**
 * host-sandbox-assets.test.mjs — C1 (offline, ZERO host boots) for the pinned
 * native sandbox asset provisioning + the pre-flight backend verdict + the
 * ENV_BLOCK-not-FAIL classification law.
 *
 * THE DEFECT this pins (measured 2026-10-28, docs/TEST_METHODS.md §9): the
 * documented fresh-worktree runtime checkout (`git clone --local
 * --no-hardlinks tests/deepseek-harness-test-use`) carries `bin/` and
 * `bin/glibc/` but NOT the binaries — `native/system/.gitignore` ignores
 * every platform package's `bin/`, so the Landlock launcher and its glibc `system.node`
 * sibling are gitignored native assets that never travel with a clone. On this
 * machine bwrap cannot run (non-privileged user namespaces refused), so
 * Landlock is the ONLY usable backend: the launcher going missing makes the
 * host fail closed with `sandbox mode "workspace-write" is requested but no
 * sandbox backend is usable on this host`, and suites recorded that as a
 * case FAIL — an environment/provisioning gap logged as a product regression.
 *
 * Legs (each one is the thing the fix must guarantee):
 *   A provisioning  T1 manifest · T2 present · T3 fresh-clone→provisioned ·
 *                   T4 wrong-hash source never lands · T5 destination mismatch ·
 *                   T6 unmanifested baseline · T7 missing source asset ·
 *                   T8 source-is-destination + source never written ·
 *                   T9 destination stays porcelain-clean · T10 no network path
 *   B pre-flight    T11 record binds probe+digest+provenance ·
 *                   T12 unprovisionable records unusable (never throws) ·
 *                   T13 supply-chain mismatch DOES throw
 *   C verdict law   T14 detector specificity · T15 u74a ENV_BLOCK conjunction ·
 *                   T16 ARC-D same conjunction · T17 run-record visibility
 *
 * Scratch lives in the repo (`.artifacts/tmp/`, gitignored) per the workspace
 * rule; no /tmp. The pinned bytes for the fixture source tree are read from
 * the MAIN Team checkout's runtime tree (read-only): these legs verify the
 * PINNED digests, so synthetic bytes would verify nothing.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { DSH_BASELINE_VERSION, findTestRepoRoot, TEST_USE_BASELINE_SHA, testUseTree } from '../paths.mjs'
import {
  HostSandboxAssetError,
  MANIFEST_REL,
  SANDBOX_PREFLIGHT_SCHEMA,
  SOURCE_TREE_ENV,
  nativeConfinementEnvBlock,
  preflightHostSandbox,
  probeHostSandboxBackend,
  provisionHostSandboxAssets,
  readHostSandboxAssetManifest,
  resolveHostSandboxLayout,
  sandboxUnavailableSignal,
} from './lib/host-sandbox-assets.mjs'
import { judgeU74a, U74A_MAIN_CASES, U74A_PLANTED_JOB_ID } from './lib/u74a-jobs-assembly.mjs'
import { judgeU6ArcD } from './lib/u6-arc-d-assembly.mjs'
import { bindSandboxPreflight, createRunRecord, exitCodeFor, formatSummary, overallVerdict } from './lib/run-record.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const SCRATCH_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'host-sbx-assets')

/** The MAIN Team checkout's runtime tree: the default provisioning source and
 *  the only place the pinned bytes exist in this environment. */
const MAIN_ROOT = findTestRepoRoot(REPO_ROOT) ?? REPO_ROOT
const MAIN_RUNTIME = testUseTree(MAIN_ROOT)

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const git = (args, cwd) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
const porcelain = (cwd) => String(git(['status', '--porcelain'], cwd).stdout ?? '').trim()

function scratch(label) {
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  return mkdtempSync(join(SCRATCH_ROOT, `${label}-`))
}

/**
 * Build a runtime tree with the shape a `git clone --local --no-hardlinks`
 * produces: the tracked files of the native system packages are present (the
 * entry lib, the platform package.json), the `bin/` and `bin/glibc/`
 * DIRECTORIES exist, and — exactly like the clone — the binaries do not.
 * The entry module is the host's OWN compiled `index.js` (read-only copy), so
 * `launcherPath()`/`probe()` run their real resolution formula on the fixture.
 */
function makeRuntimeFixture(label, { launcher = null } = {}) {
  const root = scratch(label)
  const entryDir = join(root, 'native', 'system', 'packages', 'entry', 'lib')
  const platformDir = join(root, 'native', 'system', 'packages', 'linux-x64')
  mkdirSync(join(platformDir, 'bin', 'glibc'), { recursive: true })
  mkdirSync(entryDir, { recursive: true })
  copyFileSync(join(MAIN_RUNTIME, 'native/system/packages/entry/lib/index.js'), join(entryDir, 'index.js'))
  copyFileSync(join(MAIN_RUNTIME, 'native/system/packages/linux-x64/package.json'), join(platformDir, 'package.json'))
  writeFileSync(join(root, 'native', 'system', '.gitignore'), 'packages/*/bin/\npackages/*/lib/\nnode_modules/\n')
  // the pnpm workspace link the host's require.resolve walks through
  const linkDir = join(root, 'native', 'system', 'packages', 'entry', 'node_modules', '@deepseek-ai')
  mkdirSync(linkDir, { recursive: true })
  mkdirSync(join(linkDir, 'node-addon-system-linux-x64'), { recursive: true })
  rmSync(join(linkDir, 'node-addon-system-linux-x64'), { recursive: true, force: true })
  symlinkTo(platformDir, join(linkDir, 'node-addon-system-linux-x64'))
  if (launcher !== null) {
    writeFileSync(join(platformDir, 'bin', 'landlock-run'), launcher.body)
    chmodSync(join(platformDir, 'bin', 'landlock-run'), 0o755)
    if (launcher.addon !== undefined) {
      writeFileSync(join(platformDir, 'bin', 'glibc', 'system.node'), launcher.addon)
      chmodSync(join(platformDir, 'bin', 'glibc', 'system.node'), 0o755)
    }
  }
  return root
}

function symlinkTo(target, linkPath) { symlinkSync(target, linkPath, 'dir') }

/** git-init a fixture tree with its tracked-shape files committed. */
function gitInit(dir) {
  git(['init', '-q', '.'], dir)
  git(['config', 'user.email', 'sbx@test.local'], dir)
  git(['config', 'user.name', 'sbx test'], dir)
  git(['add', '-A'], dir)
  git(['commit', '-qm', 'fresh-clone shape'], dir)
}

/** A source tree that carries the PINNED bytes (the default source shape). */
function pinnedSourceFixture(label) {
  const root = makeRuntimeFixture(label)
  const src = join(MAIN_RUNTIME, 'native/system/packages/linux-x64/bin')
  copyFileSync(join(src, 'landlock-run'), join(root, 'native/system/packages/linux-x64/bin/landlock-run'))
  copyFileSync(join(src, 'glibc/system.node'), join(root, 'native/system/packages/linux-x64/bin/glibc/system.node'))
  return root
}

/** The MEASURED tool_result a native lane answers when no backend is usable
 *  (captured verbatim from a real leg; see the evidence README). */
const SANDBOX_REFUSAL = 'Error: code run failed (sandbox-unavailable): sandbox mode "workspace-write" is requested '
  + 'but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap or '
  + 'run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS), or ensure the ACL '
  + 'restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.'

const preflightLike = (over = {}) => ({
  schema: SANDBOX_PREFLIGHT_SCHEMA,
  probed: true,
  backend: 'unusable',
  launcherPath: '/x/native/system/packages/linux-x64/bin/landlock-run',
  launcherPresent: false,
  launcherSha256: null,
  asset: null,
  ...over,
})

// ── A. provisioning ────────────────────────────────────────────────────────

test('T1 the pinned asset manifest is committed and keyed by the pinned host baseline', () => {
  assert.ok(existsSync(join(REPO_ROOT, MANIFEST_REL)), `the manifest must be committed at ${MANIFEST_REL}`)
  const m = readHostSandboxAssetManifest({ repoRoot: REPO_ROOT })
  const key = `${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`
  const entry = m.entries[key]
  assert.ok(entry, `manifest has an entry for the pinned baseline ${key} (got ${Object.keys(m.entries).join('|')})`)
  const platform = `linux-${process.arch}`
  const p = entry.platforms[platform]
  assert.ok(p, `manifest entry names this host platform ${platform}`)
  assert.match(p.launcher, /^bin\/[a-z0-9-]+$/)
  for (const [rel, spec] of Object.entries(p.files)) {
    assert.match(spec.sha256, /^[0-9a-f]{64}$/, `${rel}: sha256 must be 64 lowercase hex`)
    assert.ok(Number.isInteger(spec.bytes) && spec.bytes > 0, `${rel}: bytes must be a positive integer`)
    assert.match(spec.mode, /^0o7\d\d$/, `${rel}: mode must be executable`)
  }
  assert.ok(Object.keys(p.files).includes(p.launcher), 'the launcher is one of the manifested files')
})

test('T2 a tree whose assets are present and match the manifest reports present and writes nothing', async () => {
  const tree = pinnedSourceFixture('present')
  const source = pinnedSourceFixture('present-src')
  const bin = join(tree, 'native/system/packages/linux-x64/bin')
  const before = readdirSync(bin, { recursive: true }).map(String).sort()
  const mtimes = Object.fromEntries(before.map((f) => [f, statSync(join(bin, f)).mtimeMs]))
  const sourceDigests = Object.fromEntries(['bin/landlock-run', 'bin/glibc/system.node'].map((rel) => [rel, sha256File(join(source, 'native/system/packages/linux-x64', rel))]))
  const r = await provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT })
  assert.equal(r.action, 'present', 'present+matching must not be reported as provisioned')
  assert.equal(r.bytesWritten, 0)
  for (const f of r.files) assert.equal(f.state, 'present', `${f.relPath} must report present, not copied`)
  assert.deepEqual(readdirSync(bin, { recursive: true }).map(String).sort(), before, 'no file may appear or vanish')
  for (const [f, t] of Object.entries(mtimes)) assert.equal(statSync(join(bin, f)).mtimeMs, t, `${f} mtime moved`)
  // the source tree is never a write target
  for (const [rel, digest] of Object.entries(sourceDigests)) {
    assert.equal(sha256File(join(source, 'native/system/packages/linux-x64', rel)), digest, `${rel} in the SOURCE tree moved`)
  }
  assert.equal(r.bytesWritten, 0)
})

test('T3 a fresh-clone shaped tree is unusable, gets provisioned, and the host probe then works', async () => {
  const tree = makeRuntimeFixture('fresh')
  const source = pinnedSourceFixture('fresh-src')
  const layout = await resolveHostSandboxLayout(tree)
  assert.ok(layout.launcherPath.startsWith(join(tree, 'native/system/packages/linux-x64')),
    `launcherPath must resolve INSIDE the fixture tree, got ${layout.launcherPath}`)
  assert.equal(existsSync(layout.launcherPath), false, 'the fresh-clone shape has no launcher')

  const before = await probeHostSandboxBackend(tree)
  assert.equal(before.backend, 'unusable', 'a missing launcher probes unusable through the HOST probe()')

  const r = await provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT })
  assert.equal(r.action, 'provisioned')
  assert.ok(r.bytesWritten > 0)
  for (const f of r.files) {
    assert.equal(f.state, 'copied', `${f.relPath} should have been copied`)
    assert.equal(f.sha256, f.expectedSha256, `${f.relPath} digest must equal the pinned manifest digest`)
    assert.equal(statSync(join(layout.platformDir, f.relPath)).mode & 0o777, 0o755, `${f.relPath} must stay executable`)
  }
  const after = await probeHostSandboxBackend(tree)
  assert.ok(['partial', 'full'].includes(after.backend),
    `after provisioning the host probe must report a usable backend, got ${after.backend}`)
  assert.equal(after.launcherPresent, true)
  // provisioning never writes into the SOURCE tree
  assert.equal(sha256File(join(source, 'native/system/packages/linux-x64/bin/landlock-run')), r.files.find((f) => f.role === 'launcher').sha256)
})

test('T4 a wrong-hash source binary NEVER lands: typed error, both digests, zero residue', async () => {
  const tree = makeRuntimeFixture('badhash')
  const source = pinnedSourceFixture('badhash-src')
  writeFileSync(join(source, 'native/system/packages/linux-x64/bin/landlock-run'), '#!/bin/sh\necho not the launcher\n')
  await assert.rejects(
    provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT }),
    (e) => {
      assert.ok(e instanceof HostSandboxAssetError, `typed error expected, got ${String(e)}`)
      assert.match(e.code, /DIGEST_MISMATCH$/, `code must name a digest mismatch, got ${e.code}`)
      const m = readHostSandboxAssetManifest({ repoRoot: REPO_ROOT })
      const expected = m.entries[`${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`].platforms[`linux-${process.arch}`].files['bin/landlock-run'].sha256
      assert.ok(e.message.includes(expected), 'the message names the EXPECTED digest')
      assert.ok(e.message.includes(sha256File(join(source, 'native/system/packages/linux-x64/bin/landlock-run'))), 'the message names the ACTUAL digest')
      return true
    },
  )
  const bin = join(tree, 'native/system/packages/linux-x64/bin')
  assert.equal(existsSync(join(bin, 'landlock-run')), false, 'a mismatched binary must never be placed')
  assert.deepEqual(readdirSync(bin), ['glibc'], 'no temp/partial residue may remain in bin/')
  assert.equal(existsSync(join(tree, 'native/system/packages/linux-x64/bin/glibc/system.node')), false, 'not one file is written when any source byte fails verification')
})

test('T5 a destination whose existing bytes mismatch the manifest fails closed and is never overwritten', async () => {
  const tree = makeRuntimeFixture('dstdrift')
  const source = pinnedSourceFixture('dstdrift-src')
  const bad = makeRuntimeFixture('dstdrift-seed', { launcher: { body: 'stale-bytes', addon: 'stale-addon' } })
  const bin = join(tree, 'native/system/packages/linux-x64/bin')
  copyFileSync(join(bad, 'native/system/packages/linux-x64/bin/landlock-run'), join(bin, 'landlock-run'))
  copyFileSync(join(bad, 'native/system/packages/linux-x64/bin/glibc/system.node'), join(bin, 'glibc/system.node'))
  const before = sha256File(join(bin, 'landlock-run'))
  await assert.rejects(
    provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT }),
    (e) => {
      assert.ok(e instanceof HostSandboxAssetError)
      assert.equal(e.code, 'DESTINATION_DIGEST_MISMATCH')
      return true
    },
  )
  assert.equal(sha256File(join(bin, 'landlock-run')), before, 'bytes the runner did not create are never destroyed or overwritten')
})

test('T6 an unmanifested host baseline fails closed instead of copying anything', async () => {
  const tree = makeRuntimeFixture('nomani')
  const source = pinnedSourceFixture('nomani-src')
  const manifest = readHostSandboxAssetManifest({ repoRoot: REPO_ROOT })
  const drifted = { ...manifest, entries: { '0.0.0-nobody@0000000000000000000000000000000000000000': manifest.entries[`${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`] } }
  await assert.rejects(
    provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT, manifest: drifted }),
    (e) => e instanceof HostSandboxAssetError && e.code === 'MANIFEST_ENTRY_MISSING',
  )
  assert.equal(existsSync(join(tree, 'native/system/packages/linux-x64/bin/landlock-run')), false, 'an unmanifested baseline copies nothing')
})

test('T7 a source tree without the asset fails closed with a typed error', async () => {
  const tree = makeRuntimeFixture('nosrc')
  const source = makeRuntimeFixture('nosrc-empty') // fresh-clone shape = no binaries either
  await assert.rejects(
    provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT }),
    (e) => e instanceof HostSandboxAssetError && e.code === 'SOURCE_ASSET_MISSING',
  )
  assert.equal(existsSync(join(tree, 'native/system/packages/linux-x64/bin/landlock-run')), false)
})

test('T8 the source tree is never the destination, and the env override is honoured', async () => {
  const tree = makeRuntimeFixture('selfsrc')
  await assert.rejects(
    provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: tree, repoRoot: REPO_ROOT }),
    (e) => e instanceof HostSandboxAssetError && e.code === 'SOURCE_IS_DESTINATION',
    'copying a tree onto itself is refused, not silently a no-op',
  )
  const source = pinnedSourceFixture('envsrc')
  process.env[SOURCE_TREE_ENV] = source
  try {
    const r = await provisionHostSandboxAssets({ runtimeTree: tree, repoRoot: REPO_ROOT })
    assert.equal(r.action, 'provisioned')
    assert.equal(r.source.kind, 'env')
    assert.equal(r.source.tree, source)
  } finally {
    delete process.env[SOURCE_TREE_ENV]
  }
  assert.equal(existsSync(join(tree, 'native/system/packages/linux-x64/bin/landlock-run')), true)
})

test('T9 provisioning keeps the destination runtime tree git status --porcelain EMPTY', async () => {
  const tree = makeRuntimeFixture('porcelain')
  const source = pinnedSourceFixture('porcelain-src')
  gitInit(tree)
  assert.equal(porcelain(tree), '', 'the committed fresh-clone fixture starts clean')
  const r = await provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT })
  assert.equal(r.action, 'provisioned')
  assert.equal(porcelain(tree), '', 'the native bin assets are gitignored: the runtime tree stays porcelain-clean')
  assert.equal(r.porcelainAfter.empty, true)
})

test('T10 the provisioner has no network path (local copy only)', () => {
  // Comments legitimately tell an operator to run the runtime install; the
  // CODE is what must never reach a network or a package manager.
  const code = readFileSync(join(HERE, 'lib', 'host-sandbox-assets.mjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/(?<=\s|\(|`)\/\/[^'`\n]*/g, ' ')
  const forbidden = [
    ['network import', /node:(http|https|net|tls|dgram|dns)/],
    ['fetch call', /\bfetch\s*\(/],
    ['child-process download', /\b(curl|wget|rsync|scp)\b/],
    ['package-manager download', /(^|[^a-z])(npm|pnpm|yarn)\s+(install|add|pack|exec|dlx|view)\b/],
    ['tarball extraction', /\b(tar|unzip|gunzip)\b/],
  ]
  for (const [what, re] of forbidden) {
    const m = code.match(re)
    assert.equal(m === null, true, `the provisioner must contain no ${what}${m === null ? '' : ` (matched: ${JSON.stringify(m[0])})`}`)
  }
  // and it does reach for the file system, i.e. the local copy is real
  assert.match(code, /copyFileSync\(/)
})

// ── B. pre-flight ──────────────────────────────────────────────────────────

test('T11 the pre-flight record binds probe verdict + launcher digest + provenance', async () => {
  const tree = makeRuntimeFixture('pre')
  const source = pinnedSourceFixture('pre-src')
  gitInit(tree)
  gitInit(source)
  const p = await preflightHostSandbox({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT })
  assert.equal(p.schema, SANDBOX_PREFLIGHT_SCHEMA)
  assert.equal(p.probed, true)
  assert.equal(p.baseline.version, DSH_BASELINE_VERSION)
  assert.equal(p.baseline.sha, TEST_USE_BASELINE_SHA)
  assert.deepEqual(p.verdicts.map((v) => v.phase), ['before-provision', 'after-provision'], 'the pre-provision verdict is kept on the record')
  assert.equal(p.verdicts[0].backend, 'unusable', 'the record shows what the host WOULD have seen')
  assert.equal(p.asset.action, 'provisioned')
  assert.equal(p.asset.source.tree, source)
  assert.equal(typeof p.asset.source.runtimeHead, 'string', 'the SOURCE runtime HEAD is part of the provenance')
  assert.equal(p.asset.source.headMatchesPinnedBaseline, false, 'the fixture is not the pinned checkout: recorded, not silently dropped (the digests remain the authority)')
  assert.equal(p.launcherPresent, true)
  const m = readHostSandboxAssetManifest({ repoRoot: REPO_ROOT })
  const pinned = m.entries[`${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`].platforms[`linux-${process.arch}`]
  assert.equal(p.launcherSha256, pinned.files[pinned.launcher].sha256, 'the recorded digest IS the pinned digest')
  assert.equal(p.asset.porcelainAfter.empty, true, 'the destination is porcelain-clean right after the write')
  assert.ok(['partial', 'full'].includes(p.backend), `backend must be the post-provision verdict, got ${p.backend}`)
  assert.equal(p.backend, p.verdicts[1].backend)
  assert.equal(p.porcelainEmpty, true)
  // the record survives a JSON round-trip (it goes into a RUN record)
  assert.deepEqual(JSON.parse(JSON.stringify(p)).launcherSha256, p.launcherSha256)
})

test('T12 an unprovisionable tree records unusable + the provision error and never throws', async () => {
  const tree = makeRuntimeFixture('pre-noenv')
  const source = makeRuntimeFixture('pre-noenv-src') // nothing to copy
  const p = await preflightHostSandbox({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT })
  assert.equal(p.backend, 'unusable')
  assert.equal(p.usable, false)
  assert.equal(p.launcherPresent, false)
  assert.equal(p.launcherSha256, null)
  assert.equal(p.provisionError.code, 'SOURCE_ASSET_MISSING')
  assert.equal(p.asset, null, 'a failed provision records the error, not a provenance claim')
})

test('T13 a supply-chain digest mismatch is a THROWN pre-flight error, never a recorded backend', async () => {
  const tree = makeRuntimeFixture('pre-bad')
  const source = pinnedSourceFixture('pre-bad-src')
  writeFileSync(join(source, 'native/system/packages/linux-x64/bin/landlock-run'), 'tampered')
  await assert.rejects(
    preflightHostSandbox({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT }),
    (e) => e instanceof HostSandboxAssetError && /DIGEST_MISMATCH$/.test(e.code),
  )
  assert.equal(existsSync(join(tree, 'native/system/packages/linux-x64/bin/landlock-run')), false)
})

// ── C. the verdict law ─────────────────────────────────────────────────────

test('T14 only the host typed unavailable signal matches', () => {
  assert.equal(sandboxUnavailableSignal(SANDBOX_REFUSAL).present, true)
  assert.equal(sandboxUnavailableSignal('tool failed: code=SANDBOX_UNAVAILABLE detail=probe failed').present, true)
  for (const negative of [
    '', 'u74a ctl lane produced no claim bytes', 'Error: EACCES: permission denied, open \'/etc/shadow\'',
    'bwrap: creating new namespace failed: Operation not permitted', 'tool timed out after 120000ms',
    'sandbox mode "workspace-write" applied', 'APPROVAL_DENIED',
  ]) {
    assert.equal(sandboxUnavailableSignal(negative).present, false, `must NOT match: ${negative}`)
  }
  assert.equal(sandboxUnavailableSignal(null).present, false)
})

/** A saturated MAIN digest (the shape the u7-4a runner records; proven
 *  all-PASS by the u7-4a lane's own offline smoke). */
function u74aSaturated() {
  const claims = { bg: 'U74A_BG_CLAIM', liveWarm: 'U74A_LIVE_WARM', liveFinal: 'U74A_LIVE_FINAL', done: 'U74A_DONE_CLAIM', ctl: 'U74A_CTL_CLAIM' }
  return {
    claims,
    kernelHits: {
      'a5g7: placement-feed rows=': { count: 3 }, job_output: { count: 5 }, 'a5bg: producer-mounted': { count: 1 },
      'a5-plane: mount-REFUSED': { count: 0 }, 'a5-plane: placement-REFUSED': { count: 0 },
      PLANE_KERNEL_UNAVAILABLE: { count: 0 }, PLANE_JOBS_REGISTRATION_REFUSED: { count: 0 }, PLANE_PROCESS_REGISTRATION_REFUSED: { count: 0 },
    },
    attributedLog: ['a5bg: attributed hostJobId=bash-77 instance=inst-1 tool=bash'],
    startedJobReceipts: 2,
    laneDone: { bg: true, out: true, list: true, killLive: true, killDone: true, foreignOut: true, foreignPlanted: true, leader: true, ctl: true },
    jobIds: ['bash-77'],
    bgReceipt: 'started background job bash-77 (governed: …)',
    outResult: `${claims.bg}\n[status: exited(0)]`,
    listJobId: 'bash-78',
    listResult: 'bash-77 [bash] completed\nbash-78 [bash] running',
    killLiveJobId: 'bash-78',
    killLiveKill: 'requested cancellation of job bash-78',
    killLiveOutEarly: `${claims.liveWarm}\n[status: running]`,
    killLiveOutLate: '(no new output)\n[status: killed]',
    killDoneJobId: 'bash-79',
    killDoneOutput: `${claims.done}\n[status: exited(0)]`,
    killDoneKill: 'job bash-79 had already finished',
    foreignOut: 'job bash-77: refused: owner-mismatch — this viewer is not the job owner',
    foreignPlanted: `job ${U74A_PLANTED_JOB_ID}: refused: unattributed-job — this mount manages only jobs it created`,
    ctlResult: `${claims.ctl}\nu74a-ctl-ran`,
    rootKernelMentions: 0,
    askRows: [{ requestId: 'r1', targetInstanceId: 'inst-1', resolutions: 1, ok: true }],
    askResolutionsTotal: 1,
    trioControlRows: [],
    armingRows: [],
    memberIds: ['inst-1', 'inst-2'],
    settle: { killLiveLines: 2, plantedLines: 0 },
  }
}
const rowOf = (rows, id) => rows.find(([i]) => i === id)
const verdictOf = (rows, id) => rowOf(rows, id)[1]

test('T15 u74a native leg: ENV_BLOCK only for the probe+typed-message conjunction', () => {
  const sat = u74aSaturated()
  const unusable = preflightLike()
  const usable = preflightLike({ backend: 'partial', launcherPresent: true, launcherSha256: 'a'.repeat(64) })

  // (i) a usable backend judges EXACTLY as before: the saturated digest is all PASS
  // with and without a pre-flight, and the flipped legs stay FAIL with and without.
  const baselineRows = judgeU74a(sat, true)
  assert.deepEqual(baselineRows.map(([id]) => id), [...U74A_MAIN_CASES])
  for (const [, v] of baselineRows) assert.equal(v, 'PASS', 'the saturated digest must stay all-PASS')
  assert.deepEqual(judgeU74a(sat, true, { sandboxPreflight: usable }), baselineRows,
    'a usable/partial backend changes NO verdict at all (row-for-row)')
  const noPreflight = judgeU74a(sat, true, {})
  assert.deepEqual(noPreflight, baselineRows, 'a run without a pre-flight record is judged as before')

  // (ii) a FUNCTIONAL failure is still FAIL even when the backend is unusable.
  const functional = { ...sat, ctlResult: 'u74a-ctl-ran but the claim bytes never appeared' }
  assert.equal(verdictOf(judgeU74a(functional, true, { sandboxPreflight: unusable }), 'u74a:native-ctl-unaffected'), 'FAIL',
    'an unusable backend alone must NEVER launder a functional failure')
  assert.equal(verdictOf(judgeU74a(functional, true, { sandboxPreflight: usable }), 'u74a:native-ctl-unaffected'), 'FAIL')

  // (iii) the CONJUNCTION: unusable probe AND the typed refusal → ENV_BLOCK.
  const refused = { ...sat, ctlResult: SANDBOX_REFUSAL }
  const rows = judgeU74a(refused, true, { sandboxPreflight: unusable })
  const envRow = rowOf(rows, 'u74a:native-ctl-unaffected')
  assert.equal(envRow[1], 'ENV_BLOCK')
  assert.equal(envRow[2].sandboxPreflight.backend, 'unusable', 'the row carries the probe evidence')
  assert.deepEqual(envRow[2].typedSignal.present, true)
  // and it never colours as PASS in any channel
  const cases = rows.map(([id, verdict, detail]) => ({ id, verdict, detail }))
  assert.equal(overallVerdict(cases), 'ENV_BLOCK', 'ENV_BLOCK is the worst verdict here — never PASS')
  assert.equal(cases.some((c) => c.verdict === 'PASS' && c.id === 'u74a:native-ctl-unaffected'), false)

  // (iv) the typed message with a USABLE backend is a real failure → FAIL.
  assert.equal(verdictOf(judgeU74a(refused, true, { sandboxPreflight: usable }), 'u74a:native-ctl-unaffected'), 'FAIL',
    'the message alone is never enough: the probe must say unusable')
  // (v) a hand-made lookalike object is not a pre-flight record → FAIL.
  assert.equal(verdictOf(judgeU74a(refused, true, { sandboxPreflight: { backend: 'unusable' } }), 'u74a:native-ctl-unaffected'), 'FAIL',
    'only a real probe record (right schema, probed) opens the ENV_BLOCK path')
  assert.equal(nativeConfinementEnvBlock({ observedText: SANDBOX_REFUSAL, preflight: { backend: 'unusable' } }), null)
  assert.equal(nativeConfinementEnvBlock({ observedText: 'nothing wrong', preflight: unusable }), null)
  assert.ok(nativeConfinementEnvBlock({ observedText: SANDBOX_REFUSAL, preflight: unusable }))
})

function arcdGood() {
  return {
    probeRows: [
      { leg: 'family-mount', ok: true },
      { leg: 'register', kind: 'probe-tool', ok: true },
      { leg: 'walk', action: 'walk', callId: 'pos-1', ok: true },
      { leg: 'walk', action: 'spoof', callId: 'spoof-1', ok: false },
      { leg: 'walk', action: 'swap', callId: 'swap-1', ok: false },
      { leg: 'walk', action: 'unbound', callId: 'unbound-1', ok: false, outcome: 'defer' },
      { leg: 'walk', action: 'walk', callId: 'replay-1', ok: false, code: 'GRANT_REPLAY' },
      { leg: 'teardown', ok: true },
      { leg: 'walk', action: 'walk', callId: 'post-1', ok: false, code: 'KERNEL_NOT_ACTIVE' },
      { leg: 'govern', action: 'restrict-on', ok: true },
      { leg: 'govern', action: 'restrict-off', ok: true },
      { leg: 'pair-effect', marker: 'U6ARCD_PAIR_LIFT_x', pathTail: 'u6arcd-pair-lift.txt', ok: true },
    ],
    markerFiles: ['pos-1-marker.txt'],
    markerNonces: { 'pos-1-marker.txt': 'NONCE_POS' },
    nativeEvidence: { readFromDisk: true, present: true, contentMatches: true, pathTail: 'u6arcd-native-effect.txt' },
    nativeGrepParity: { claimOccurrences: 1 },
    pairEvidence: {
      pairDeny: { readFromDisk: true, present: false, contentMatches: false, marker: 'U6ARCD_PAIR_DENY_x', pathTail: 'u6arcd-pair-denied.txt' },
      pairLift: { readFromDisk: true, present: true, contentMatches: true, marker: 'U6ARCD_PAIR_LIFT_x', pathTail: 'u6arcd-pair-lift.txt' },
    },
    hostAlive: true,
  }
}
const noEffect = (d) => ({ ...d, nativeEvidence: { ...d.nativeEvidence, present: false, contentMatches: false } })

test('T16 ARC-D native parity shares the conjunction: ENV_BLOCK only when probe+typed message agree', () => {
  const unusable = preflightLike()
  const usable = preflightLike({ backend: 'full', launcherPresent: true, launcherSha256: 'b'.repeat(64) })
  const signal = { present: true, head: SANDBOX_REFUSAL.slice(0, 200) }
  const noSignal = { present: false, head: null }

  assert.equal(verdictOf(judgeU6ArcD(arcdGood()), 'arcd:ci03-native-parity'), 'PASS')
  assert.equal(verdictOf(judgeU6ArcD({ ...arcdGood(), sandboxPreflight: usable, nativeLaneSignal: signal }), 'arcd:ci03-native-parity'), 'PASS',
    'a usable backend changes nothing: the disk oracle still decides')

  const conj = judgeU6ArcD({ ...noEffect(arcdGood()), sandboxPreflight: unusable, nativeLaneSignal: signal })
  const row = rowOf(conj, 'arcd:ci03-native-parity')
  assert.equal(row[1], 'ENV_BLOCK')
  assert.equal(row[2].sandboxPreflight.backend, 'unusable')
  // every other combination stays FAIL (the conjunction is the ONLY door)
  assert.equal(verdictOf(judgeU6ArcD(noEffect(arcdGood())), 'arcd:ci03-native-parity'), 'FAIL', 'no pre-flight at all = judged as before')
  assert.equal(verdictOf(judgeU6ArcD({ ...noEffect(arcdGood()), sandboxPreflight: usable, nativeLaneSignal: signal }), 'arcd:ci03-native-parity'), 'FAIL')
  assert.equal(verdictOf(judgeU6ArcD({ ...noEffect(arcdGood()), sandboxPreflight: unusable, nativeLaneSignal: noSignal }), 'arcd:ci03-native-parity'), 'FAIL',
    'an unusable backend with no typed refusal in the lane is a functional FAIL')
  assert.equal(verdictOf(judgeU6ArcD({ ...noEffect(arcdGood()), sandboxPreflight: { backend: 'unusable' }, nativeLaneSignal: signal }), 'arcd:ci03-native-parity'), 'FAIL',
    'a forged lookalike pre-flight never opens the door')
  // the disk law itself is untouched: a file WITHOUT this run's marker is FAIL even under the conjunction
  const wrongBytes = { ...arcdGood(), nativeEvidence: { ...arcdGood().nativeEvidence, present: true, contentMatches: false } }
  assert.equal(verdictOf(judgeU6ArcD({ ...wrongBytes, sandboxPreflight: unusable, nativeLaneSignal: signal }), 'arcd:ci03-native-parity'), 'FAIL',
    'bytes the native lane did not write are a product finding, not an environment block')
})

test('T17 the pre-flight is visible on the RUN record and in the summary line', () => {
  const record = createRunRecord({
    runId: 'sbx-unit', suite: 'u7-sbx-unit', selectedCases: ['a:pass', 'b:envblock'],
    bindings: { worldIds: ['w1'] },
  })
  const pre = preflightLike()
  bindSandboxPreflight(record.record.bindings, pre)
  record.addCase('a:pass', 'PASS')
  record.addCase('b:envblock', 'ENV_BLOCK', { reason: 'native backend unusable' })
  const out = record.finalize()
  assert.equal(out.overall, 'ENV_BLOCK', 'severity ordering is unchanged: ENV_BLOCK beats PASS')
  assert.equal(exitCodeFor(out), 1, 'ENV_BLOCK never exits 0')
  assert.equal(record.record.bindings.nativeConfinementBackend, 'unusable', 'the backend verdict is on the bindings')
  assert.equal(record.record.bindings.sandboxPreflight.probed, true)
  assert.ok(String(record.record.bindings.nativeConfinementDisclosure).length > 0, 'the record carries a visible disclosure')
  const line = formatSummary(out)
  assert.match(line, /overall=ENV_BLOCK/)
  assert.match(line, /nativeBackend=unusable/, 'the summary line says the native legs ran on an unusable backend')
  // a usable backend adds no marker
  const r2 = createRunRecord({ runId: 'sbx-unit2', suite: 's', selectedCases: ['a:pass'], bindings: {} })
  bindSandboxPreflight(r2.record.bindings, preflightLike({ backend: 'partial' }))
  r2.addCase('a:pass', 'PASS')
  const line2 = formatSummary(r2.finalize())
  assert.equal(line2.includes('nativeBackend'), false, 'no marker when the backend is usable')
  assert.match(line2, /overall=PASS/)
})
