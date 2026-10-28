/**
 * f6-hostile-manifest-proof.mjs — review round 1 (F6), outside the C1 fixture
 * harness: a hostile pinned manifest whose file key traverses OUT of the
 * platform package's `bin/`, driven through the real provisioner.
 *
 * The finding: the containment check used to run AFTER mkdir/copy/rename, so a
 * hostile key both wrote the file and left it behind (the rollback loop only
 * removes what the loop recorded as published, and the throw happened before
 * the push). The fix validates every manifest-declared relative path BEFORE any
 * filesystem mutation, so the tree is untouched and the typed refusal names the
 * rejected key.
 *
 * Run: node dev/agent-workflow/evidence/u7-sbx-20261028/f6-hostile-manifest-proof.mjs
 * Prints the facts, asserts the fixed behaviour, exits non-zero on regression.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const { provisionHostSandboxAssets, HostSandboxAssetError } = await import(join(REPO_ROOT, 'tests/world-factory/lib/host-sandbox-assets.mjs'))
const { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA, findTestRepoRoot, testUseTree } = await import(join(REPO_ROOT, 'tests/paths.mjs'))

const MAIN = testUseTree(findTestRepoRoot(REPO_ROOT) ?? REPO_ROOT)
const REL = '../landlock-evil' // escapes the platform package, stays inside packages/

const scratch = join(REPO_ROOT, '.artifacts', 'tmp', `f6-proof-${process.pid}`)
mkdirSync(scratch, { recursive: true })

/** A runtime-shaped tree; `withAssets` = a provisioned source tree. */
function fixture(label, { assets }) {
  const root = join(scratch, label)
  const entryDir = join(root, 'native', 'system', 'packages', 'entry', 'lib')
  const pkg = join(root, 'native', 'system', 'packages', 'linux-x64')
  mkdirSync(join(pkg, 'bin', 'glibc'), { recursive: true })
  mkdirSync(entryDir, { recursive: true })
  copyFileSync(join(MAIN, 'native/system/packages/entry/lib/index.js'), join(entryDir, 'index.js'))
  copyFileSync(join(MAIN, 'native/system/packages/linux-x64/package.json'), join(pkg, 'package.json'))
  const linkRoot = join(root, 'native', 'system', 'packages', 'entry', 'node_modules', '@deepseek-ai')
  mkdirSync(linkRoot, { recursive: true })
  symlinkSync(pkg, join(linkRoot, 'node-addon-system-linux-x64'), 'dir')
  if (assets) {
    copyFileSync(join(MAIN, 'native/system/packages/linux-x64/bin/landlock-run'), join(pkg, 'bin/landlock-run'))
    copyFileSync(join(MAIN, 'native/system/packages/linux-x64/bin/glibc/system.node'), join(pkg, 'bin/glibc/system.node'))
  }
  return root
}

const listing = (dir) => readdirSync(dir, { recursive: true }).map(String).sort().join(' ')
const tree = fixture('destination', { assets: false })
const source = fixture('source', { assets: true })
const packagesDir = join(tree, 'native', 'system', 'packages')
const before = listing(packagesDir)

// The committed manifest, plus one traversing key carrying the REAL pinned bytes.
const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'tests/world-factory/lib/host-sandbox-assets-manifest.json'), 'utf8'))
const platform = manifest.entries[`${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`].platforms['linux-x64']
platform.files[REL] = { ...platform.files[platform.launcher] }
// The source carries the pinned bytes at the hostile location too, so a missing
// validation is a real write — not an early "source asset missing".
copyFileSync(join(source, 'native/system/packages/linux-x64/bin/landlock-run'), resolve(join(source, 'native/system/packages/linux-x64'), REL))

let error = null
try {
  await provisionHostSandboxAssets({ runtimeTree: tree, sourceTree: source, repoRoot: REPO_ROOT, manifest })
} catch (e) {
  error = e
}

const residue = existsSync(join(packagesDir, 'landlock-evil'))
console.log(`manifest key      : ${JSON.stringify(REL)} (bytes = the pinned launcher, so a copy WOULD succeed)`)
console.log(`threw             : ${error === null ? '(nothing!)' : `${error.constructor.name} ${error.code}`}`)
console.log(`message           : ${String(error?.message ?? '').slice(0, 160)}`)
console.log(`residue outside bin/: ${residue}`)
console.log(`packages/ before  : ${before}`)
console.log(`packages/ after   : ${listing(packagesDir)}`)
console.log(`bin/ after        : ${listing(join(tree, 'native/system/packages/linux-x64/bin'))}`)

assert.ok(error instanceof HostSandboxAssetError, 'the provisioner must refuse, not copy')
assert.equal(error.code, 'MANIFEST_PATH_UNSAFE', 'the refusal is the pre-write path validation, not a post-write cleanup')
assert.ok(error.message.includes(REL), 'the message names the rejected key')
assert.equal(residue, false, 'nothing was created outside bin/')
assert.equal(listing(packagesDir), before, 'the destination tree is byte-for-byte untouched')

rmSync(scratch, { recursive: true, force: true })
console.log('F6-PROOF pass: refused before the first mkdir, zero residue, tree untouched')
