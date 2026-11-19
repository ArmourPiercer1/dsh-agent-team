/**
 * provisioning-controls.test.mjs — the NEXT-HOST provisioning refusals, FIRED.
 *
 * WHY THIS FILE EXISTS. Collecting the next-host lane in CI (Task B, 2026-11-19)
 * only removes one failure mode — "the suite ran nowhere". The other failure mode
 * is worse: a lane that runs and reports GREEN while the host it executed was not
 * the pinned one. Every property this lane claims (the tag's commit, the tree's
 * HEAD, its declared version, the build entry, the published native bytes and
 * their mode) is therefore a REFUSAL with a code, and this suite fires each
 * refusal against a fixture tree so a future edit that turns one of them into a
 * warning — or into nothing — is RED here, in seconds, host-free.
 *
 * NOT A SECOND IMPLEMENTATION. The verifiers under test are the same
 * `verifyNextHostTree` / `verifyNextHostAssets` that `assertNextHostTree` /
 * `assertNextHostAssets` call before every next-host boot, and that
 * `scripts/provision-next-host.mjs` uses to grade the materialized tree. The
 * fixtures only supply the paths/expected values those functions take.
 *
 * NO SKIP PATH. If a fixture cannot be built the test FAILS; there is no
 * `t.skip()` here, because a skipped refusal control is exactly the "discovered
 * but never executed" state this lane exists to end.
 *
 * CORE PATCH BUDGET = 0: fixtures live under `.artifacts/tmp/` (gitignored) and
 * are deleted at teardown; no host tree is read or written.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { NEXT_HOST } from '../paths.mjs'
import { NEXT_LANE_REPO_ROOT, verifyNextHostAssets, verifyNextHostTree } from './host-next-lib.mjs'

const ROOT = join(NEXT_LANE_REPO_ROOT, '.artifacts', 'tmp', 'next-host-lane')

/** The published pin of the addon's system.node (docs/TEST_METHODS.md §9/§11.3). */
const PUBLISHED_SYSTEM_NODE = Object.freeze({
  sha256: '54a9c25c05186c17520f6b7a5ced5f005752c08044c3eb76524cd517287600bc',
  bytes: 17360,
  mode: '0o755',
})

/** Create a throwaway fixture root; every test removes what it created. */
function fixtureRoot(label) {
  mkdirSync(ROOT, { recursive: true })
  return mkdtempSync(join(ROOT, `controls-${label}-`))
}

function git(cwd, argv) {
  const result = spawnSync('git', ['-c', 'user.email=next-host-lane@example.invalid', '-c', 'user.name=next-host-lane', ...argv], { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`fixture git ${argv.join(' ')} failed: ${String(result.stderr ?? '')}`)
  return String(result.stdout ?? '').trim()
}

/**
 * A fixture tree shaped like the real one: a git checkout, a declared version and
 * a build entry, plus the given `native/system/packages/<platform>/bin/` files.
 */
function makeTree(label, { version = NEXT_HOST.version, built = true, assets = {} } = {}) {
  const root = fixtureRoot(label)
  mkdirSync(join(root, 'apps', 'cli', 'lib'), { recursive: true })
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({ name: 'fixture-host', version }, null, 2)}\n`)
  if (built) writeFileSync(join(root, 'apps', 'cli', 'lib', 'bin.js'), '// fixture build entry\n')
  if (Object.keys(assets).length > 0) {
    const binDir = join(root, 'native', 'system', 'packages', `${process.platform}-${process.arch}`, 'bin')
    for (const [rel, bytes] of Object.entries(assets)) {
      const path = join(binDir, rel)
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, bytes, { mode: 0o755 })
    }
  }
  git(root, ['init', '-q', '.'])
  git(root, ['add', '-A'])
  git(root, ['commit', '-q', '-m', 'fixture host at a pinned commit'])
  const head = git(root, ['rev-parse', 'HEAD'])
  return { root, head }
}

/** A pin derived from a fixture's ACTUAL bytes/files — what a control expects to pass. */
function pinOf(files) {
  const out = {}
  for (const [rel, bytes] of Object.entries(files)) {
    out[rel] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, mode: '0o755' }
  }
  return out
}

/**
 * Assert that `fn` refuses with EXACTLY `code`, and print one greppable line so
 * the transcript shows the refusal firing rather than a restated claim.
 */
function refusal(id, code, fn) {
  let error = null
  try {
    fn()
  } catch (caught) {
    error = caught
  }
  assert.notEqual(error, null, `${id}: the verifier did NOT refuse — absence/drift was accepted`)
  assert.equal(error.code, code, `${id}: refused with ${String(error.code)} (${error.message}), expected ${code}`)
  console.log(`NEXT-CONTROL ${id} refused code=${code} message=${JSON.stringify(error.message.slice(0, 300))}`)
  return error
}

const platformBin = (root) => join(root, 'native', 'system', 'packages', `${process.platform}-${process.arch}`, 'bin')

test('POSITIVE control: an honest fixture tree + its own pinned bytes pass (the refusals below are not vacuous)', () => {
  const systemNode = Buffer.from('fixture system.node bytes\n')
  const launcher = Buffer.from('fixture landlock-run bytes\n')
  const { root, head } = makeTree('positive', { assets: { 'glibc/system.node': systemNode, 'landlock-run': launcher } })
  try {
    const tree = verifyNextHostTree(root, { version: NEXT_HOST.version, sha: head, tag: 'fixture' })
    assert.deepEqual(tree, { tree: root, head, version: NEXT_HOST.version })
    const pin = pinOf({ 'glibc/system.node': systemNode, 'landlock-run': launcher })
    const assets = verifyNextHostAssets({ platformDir: platformBin(root), files: pin, launcher: 'landlock-run', tree: root })
    assert.deepEqual(assets.files.map((f) => f.relPath).sort(), ['glibc/system.node', 'landlock-run'])
    assert.ok(assets.files.every((f) => f.mode === '0o755'), 'the fixture bytes are 0o755 like the published artifact')
    console.log(`NEXT-CONTROL positive ok head=${head} files=${assets.files.length}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('TREE_MISSING — a lane with no host tree is RED and names the tree it looked for', () => {
  const root = fixtureRoot('missing')
  try {
    const tree = join(root, NEXT_HOST.treeRel)
    const error = refusal('tree-missing', 'TREE_MISSING', () => verifyNextHostTree(tree, NEXT_HOST))
    assert.ok(error.message.includes(tree), `the refusal names the absent tree: ${error.message}`)
    assert.ok(error.message.includes(NEXT_HOST.tag), 'the refusal names the pinned tag to clone')
    assert.equal(existsSync(tree), false, 'no tree was fabricated by the verifier')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('NOT_BUILT — a pinned clone that was never built is RED, never "nothing to run"', () => {
  const { root, head } = makeTree('not-built', { built: false })
  try {
    const error = refusal('not-built', 'NOT_BUILT', () => verifyNextHostTree(root, { version: NEXT_HOST.version, sha: head }))
    assert.ok(error.message.includes('apps/cli/lib/bin.js'), 'the refusal names the missing build entry')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('NOT_A_GIT_CHECKOUT — a directory that is not a checkout cannot claim a commit', () => {
  const root = fixtureRoot('not-git')
  try {
    mkdirSync(join(root, 'apps', 'cli', 'lib'), { recursive: true })
    writeFileSync(join(root, 'apps', 'cli', 'lib', 'bin.js'), '// build entry without a history\n')
    refusal('not-a-git-checkout', 'NOT_A_GIT_CHECKOUT', () => verifyNextHostTree(root, { version: NEXT_HOST.version, sha: NEXT_HOST.sha }))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('HEAD_DRIFT — a tree at the wrong commit is refused, and the message names both commits', () => {
  const { root, head } = makeTree('head-drift')
  try {
    const wrong = '0'.repeat(40)
    assert.notEqual(head, wrong)
    const error = refusal('head-drift', 'HEAD_DRIFT', () => verifyNextHostTree(root, { version: NEXT_HOST.version, sha: wrong }))
    assert.ok(error.message.includes(head) && error.message.includes(wrong), `names measured and pinned commits: ${error.message}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('VERSION_DRIFT — a tree that declares another version is not the pinned host', () => {
  const { root, head } = makeTree('version-drift', { version: '0.2.2-rc.3' })
  try {
    const error = refusal('version-drift', 'VERSION_DRIFT', () => verifyNextHostTree(root, { version: NEXT_HOST.version, sha: head }))
    assert.ok(error.message.includes('0.2.2-rc.3') && error.message.includes(NEXT_HOST.version), `names declared and pinned versions: ${error.message}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('VERSION_UNREADABLE — an unreadable package.json refuses instead of guessing a version', () => {
  const { root, head } = makeTree('version-unreadable')
  try {
    writeFileSync(join(root, 'package.json'), '{ not json\n')
    refusal('version-unreadable', 'VERSION_UNREADABLE', () => verifyNextHostTree(root, { version: NEXT_HOST.version, sha: head }))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PIN_INVALID — an unpinned expectation is refused before any file is read', () => {
  const { root } = makeTree('pin-invalid')
  try {
    refusal('pin-invalid-tree', 'PIN_INVALID', () => verifyNextHostTree(root, { version: NEXT_HOST.version, sha: 'not-a-sha' }))
    refusal('pin-invalid-assets', 'PIN_INVALID', () => verifyNextHostAssets({ platformDir: platformBin(root), files: {}, launcher: 'landlock-run', tree: root }))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ASSET_MISSING — absent native assets are RED and name the provisioning command', () => {
  const systemNode = Buffer.from('fixture system.node bytes\n')
  const { root, head } = makeTree('asset-missing', { assets: { 'glibc/system.node': systemNode } })
  try {
    verifyNextHostTree(root, { version: NEXT_HOST.version, sha: head })
    const pin = pinOf({ 'glibc/system.node': systemNode, 'landlock-run': Buffer.from('not provisioned\n') })
    const error = refusal('asset-missing', 'ASSET_MISSING', () => verifyNextHostAssets({ platformDir: platformBin(root), files: pin, launcher: 'landlock-run', tree: root }))
    assert.ok(error.message.includes('--assets'), `the refusal names the fix: ${error.message}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ASSET_DIGEST_DRIFT — a LOCALLY BUILT system.node is not the published pin', () => {
  // The measured hosted-runner defect this arm encodes: `pnpm run build` writes a
  // system.node that is 17352 B / 75450f92…, not the published 17360 B / 54a9c25c….
  // SAME LENGTH, different bytes: the length check cannot be what refuses this,
  // so the arm proves the DIGEST is load-bearing on its own.
  const locallyBuilt = Buffer.alloc(PUBLISHED_SYSTEM_NODE.bytes, 0x41)
  assert.equal(locallyBuilt.length, PUBLISHED_SYSTEM_NODE.bytes, 'the fixture is the published LENGTH on purpose')
  const { root, head } = makeTree('asset-digest', {
    assets: { 'glibc/system.node': locallyBuilt, 'landlock-run': Buffer.from('fixture launcher\n') },
  })
  try {
    verifyNextHostTree(root, { version: NEXT_HOST.version, sha: head })
    const error = refusal('asset-digest-drift', 'ASSET_DIGEST_DRIFT', () => verifyNextHostAssets({
      platformDir: platformBin(root),
      files: {
        'glibc/system.node': PUBLISHED_SYSTEM_NODE,
        'landlock-run': pinOf({ 'landlock-run': Buffer.from('fixture launcher\n') })['landlock-run'],
      },
      launcher: 'landlock-run',
      tree: root,
    }))
    const actual = createHash('sha256').update(locallyBuilt).digest('hex')
    assert.ok(error.message.includes(PUBLISHED_SYSTEM_NODE.sha256), `names the PUBLISHED pin: ${error.message}`)
    assert.ok(error.message.includes(actual), `names the measured local bytes: ${error.message}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ASSET_BYTES_DRIFT — a manifest row whose length disagrees with its own sha256 is refused', () => {
  const bytes = Buffer.from('fixture landlock-run bytes\n')
  const { root } = makeTree('asset-bytes', { assets: { 'landlock-run': bytes } })
  try {
    const pin = pinOf({ 'landlock-run': bytes })
    pin['landlock-run'] = { ...pin['landlock-run'], bytes: bytes.length + 1 }
    refusal('asset-bytes-drift', 'ASSET_BYTES_DRIFT', () => verifyNextHostAssets({ platformDir: platformBin(root), files: pin, launcher: 'landlock-run', tree: root }))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ASSET_MODE_DRIFT — the pinned mode (0o755) is part of the pin', () => {
  const bytes = Buffer.from('fixture landlock-run bytes\n')
  const { root } = makeTree('asset-mode', { assets: { 'landlock-run': bytes } })
  try {
    const path = join(platformBin(root), 'landlock-run')
    // Same bytes, wrong mode: the file is the published artifact's content but not
    // its executable bit — a host that cannot exec it is not the pinned host.
    chmodSync(path, 0o644)
    assert.equal(statSync(path).mode & 0o777, 0o644)
    const pin = pinOf({ 'landlock-run': bytes })
    const error = refusal('asset-mode-drift', 'ASSET_MODE_DRIFT', () => verifyNextHostAssets({ platformDir: platformBin(root), files: pin, launcher: 'landlock-run', tree: root }))
    assert.ok(error.message.includes('0o644') && error.message.includes('0o755'), `names measured and pinned mode: ${error.message}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('HOST PIN — the fixture controls grade the SAME pin the lane executes', () => {
  assert.match(NEXT_HOST.sha, /^[0-9a-f]{40}$/)
  assert.equal(NEXT_HOST.tag, 'dsh-v0.2.2-rc.5')
  assert.equal(NEXT_HOST.version, '0.2.2-rc.5')
  // Host version and asset version are different facts and are never derived from
  // each other: npm publishes exactly one addon version (0.1.2) for this host.
  assert.equal(NEXT_HOST.nativeAddonVersion, '0.1.2')
  assert.deepEqual(JSON.parse(JSON.stringify(NEXT_HOST.portBands)), [[13000, 13049]])
  console.log(`NEXT-CONTROL host-pin ok tag=${NEXT_HOST.tag} head=${NEXT_HOST.sha} version=${NEXT_HOST.version} addon=${NEXT_HOST.nativeAddonVersion} ports=13000-13049`)
})
