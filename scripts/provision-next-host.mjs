#!/usr/bin/env node
/**
 * provision-next-host.mjs — materialize / assert / provision the SECOND pinned
 * DSH host (0.2.2-rc.5, `tests/paths.mjs#NEXT_HOST`) with named refusals.
 *
 *   node scripts/provision-next-host.mjs --materialize   # clone by tag + assert HEAD/version + install + build
 *   node scripts/provision-next-host.mjs --assets        # published native assets (exact version, digest-verified)
 *   node scripts/provision-next-host.mjs --verify        # no network, no writes: assert tree + assets only
 *
 * WHY THIS FILE EXISTS. `tests/deepseek-harness-next/` is gitignored (it is its own
 * git checkout at an upstream tag), so a hosted runner NEVER has it, and the
 * native `bin/` payload is not in the host's git either (native/system/.gitignore).
 * Before 2026-11-19 the next-host lane was therefore EXCLUDED from CI, and the
 * exclusion was the whole defect: "discovered but never executed" was the only
 * state the second pinned host could be in on a runner. This CLI is the
 * provisioning half of collecting it (docs/TEST_METHODS.md §11.2/§11.3):
 *
 *   1. the TAG is resolved from upstream and must equal the pin BEFORE anything
 *      is cloned (`TAG_DRIFT`), and HEAD after checkout must equal it again
 *      (`HEAD_DRIFT`) — a moved tag cannot substitute for the pin;
 *   2. the tree's own `version` must equal the pin (`VERSION_DRIFT`), so the pin
 *      is checked against content, not only against a ref name;
 *   3. install/build use the tree's OWN pinned package manager
 *      (`packageManager: pnpm@…`, read, never typed here) — the same measured
 *      chain as §11.2, and the build is called through pnpm so the host's build
 *      orchestrator finds `npm_execpath`;
 *   4. the native assets are provisioned from the PINNED PUBLISHED package through
 *      the ONE shared transport (`provisionHostSandboxAssetsFromPackage`, host
 *      `next`), never from a local build: a hosted runner's `pnpm run build`
 *      produces a DIFFERENT `bin/glibc/system.node` (measured 75450f92…/17352 B
 *      vs the pin 54a9c25c…/17360 B), and the published 0.1.2 tarball is the
 *      fixed artifact that carries the pinned bytes.
 *
 * HOST VERSION ≠ ASSET VERSION, stated once: the host is 0.2.2-rc.5, the native
 * addon package is `@deepseek-ai/node-addon-system-linux-x64@0.1.2` (npm has
 * published exactly one version of it), and both are read from the committed pins
 * — neither is derived from the other.
 *
 * OUTPUT, always one machine-greppable line:
 *   NEXT-HOST-MATERIALIZED tag=… head=… version=… pnpm=… tree=…   (exit 0)
 *   NEXT-HOST-ASSETS package=… version=… tarballSha256=… host=… manifestDigest=… receipt=…
 *   NEXT-HOST-VERIFIED head=… version=… assets=…                  (exit 0)
 *   NEXT-HOST-REFUSED code=… detail=…                             (exit 1, nothing silently skipped)
 *
 * CORE PATCH BUDGET = 0: the host tree is cloned, installed and built, never
 * edited; the only host-tree writes are the gitignored build outputs and the
 * provisioned `bin/` assets the shared transport verifies byte-for-byte.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NEXT_HOST, nextHostTree } from '../tests/paths.mjs'
import { verifyNextHostAssets, verifyNextHostTree } from '../tests/next-host/host-next-lib.mjs'
import {
  HostSandboxAssetError,
  detectedLibcVariant,
  manifestDigest,
  manifestPlatformEntry,
  provisionHostSandboxAssetsFromPackage,
  readHostSandboxAssetManifest,
} from '../tests/world-factory/lib/host-sandbox-assets.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** The Team tree this CLI lives in. */
const TEAM_TREE = resolve(HERE, '..')

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return null
  const value = args[i + 1] ?? null
  return value !== null && !value.startsWith('--') ? value : null
}
const flag = (name) => args.includes(`--${name}`)

/**
 * A refusal of THIS CLI. Every one is named: the message is
 * `NEXT-HOST-REFUSED code=<CODE> detail=…`, so the job log says which property of
 * the pinned host failed instead of "command exited 1".
 */
class NextHostProvisionError extends Error {
  constructor(code, detail) {
    super(detail)
    this.name = 'NextHostProvisionError'
    this.code = code
  }
}

const usage = () => {
  console.log([
    'usage: node scripts/provision-next-host.mjs <mode> [options]',
    '',
    '  --materialize        resolve the tag from upstream, clone/fetch it, assert HEAD + version,',
    '                       install and build with the tree\'s own pinned pnpm. Network required.',
    '  --assets             provision the PINNED PUBLISHED native asset package for this host',
    '                       (exact version, registry dist.integrity + committed sha256, per-file',
    '                       sha256/length/mode) through the shared transport. Network required.',
    '  --verify             assert tree (HEAD, version, build) and native assets. No network, no writes.',
    '  --tree <path>        host tree (default: tests/paths.mjs#NEXT_HOST.treeRel under the repo root)',
    '  --store-dir <path>   pnpm store (default: <repo>/.artifacts/tmp/next-host/pnpm-store)',
    '  --tools-dir <path>   where the tree-pinned pnpm is installed (default: <repo>/.artifacts/tmp/next-host/tools)',
    '  --receipt <path>     asset provisioning receipt path (default: .artifacts/tmp/host-assets/…)',
    '  --help               this text',
    '',
    'exit 0 = the requested state is true · 1 = refused (typed code on NEXT-HOST-REFUSED)',
  ].join('\n'))
}

/** Run one child command, inheriting stdio so the CI log is the transcript. */
function run(cmd, argv, { cwd, env, code }) {
  console.log(`NEXT-HOST-STEP ${cmd} ${argv.join(' ')}${cwd ? ` (cwd=${cwd})` : ''}`)
  const result = spawnSync(cmd, argv, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
  if (result.error !== undefined && result.error !== null) {
    throw new NextHostProvisionError(code, `${cmd} could not be spawned: ${String(result.error.message ?? result.error)}`)
  }
  if (result.status !== 0) {
    throw new NextHostProvisionError(code, `${cmd} ${argv.join(' ')} exited ${String(result.status)}${result.signal ? ` (signal ${result.signal})` : ''}`)
  }
}

/** Run one child command and return trimmed stdout (for assertions, never for grading). */
function capture(cmd, argv, { cwd, env } = {}) {
  const result = spawnSync(cmd, argv, { cwd, env: { ...process.env, ...env }, encoding: 'utf8' })
  return {
    status: result.status,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
  }
}

/** The tree must live inside the session workspace (TEST_METHODS §5/§11.4). */
function assertInsideWorkspace(repoRoot, tree) {
  const root = resolve(repoRoot)
  const abs = resolve(tree)
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new NextHostProvisionError('TREE_OUTSIDE_WORKSPACE', `${abs} is outside the Team tree ${root}; a test host never lives outside the workspace`)
  }
}

/** Resolve the tag upstream and refuse unless it IS the pin. */
function assertTagPinned(treeOrNull) {
  const cwd = treeOrNull ?? TEAM_TREE
  const ls = capture('git', ['ls-remote', '--tags', NEXT_HOST.url, `refs/tags/${NEXT_HOST.tag}`])
  if (ls.status !== 0) {
    throw new NextHostProvisionError('TAG_UNRESOLVABLE', `git ls-remote ${NEXT_HOST.url} refs/tags/${NEXT_HOST.tag} failed: ${ls.stderr || `exit ${String(ls.status)}`}`)
  }
  const line = ls.stdout.split('\n').find((l) => l.endsWith(`refs/tags/${NEXT_HOST.tag}`)) ?? ''
  const sha = line.split('\t')[0]?.trim() ?? ''
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new NextHostProvisionError('TAG_MISSING', `upstream ${NEXT_HOST.url} has no refs/tags/${NEXT_HOST.tag} (ls-remote printed ${JSON.stringify(ls.stdout.slice(0, 200))}) — the pinned tag is the transport, and it must exist upstream`)
  }
  if (sha !== NEXT_HOST.sha) {
    throw new NextHostProvisionError('TAG_DRIFT', `${NEXT_HOST.url} refs/tags/${NEXT_HOST.tag} is ${sha}, tests/paths.mjs pins ${NEXT_HOST.sha} — a moved tag is not a weaker pin, it is a different host`)
  }
  void cwd
  return sha
}

/** Clone or refresh the tree at the pinned tag, then assert HEAD/version/build. */
function materialize({ tree, store, tools }) {
  assertTagPinned(null)
  const gitDir = join(tree, '.git')
  if (existsSync(tree) && !existsSync(gitDir)) {
    throw new NextHostProvisionError('TREE_NOT_A_CHECKOUT', `${tree} exists but is not a git checkout — refusing to delete or overwrite a directory this CLI did not create; move it away by hand and re-run`)
  }
  if (!existsSync(tree)) {
    mkdirSync(dirname(tree), { recursive: true })
    run('git', ['clone', '--branch', NEXT_HOST.tag, '--depth', '1', NEXT_HOST.url, tree], { code: 'CLONE_FAILED' })
  } else {
    const origin = capture('git', ['-C', tree, 'remote', 'get-url', 'origin'])
    if (origin.status !== 0) {
      throw new NextHostProvisionError('REMOTE_UNREADABLE', `${tree} is a git checkout with no readable origin: ${origin.stderr}`)
    }
    if (origin.stdout !== NEXT_HOST.url) {
      throw new NextHostProvisionError('REMOTE_MISMATCH', `${tree} fetches from ${JSON.stringify(origin.stdout)}, the pin's remote is ${JSON.stringify(NEXT_HOST.url)} — a tree fetched from another remote is never the pinned host`)
    }
    run('git', ['-C', tree, 'fetch', '--depth', '1', '--no-tags', 'origin', `refs/tags/${NEXT_HOST.tag}`], { code: 'FETCH_FAILED' })
    run('git', ['-C', tree, 'checkout', '--detach', '--force', 'FETCH_HEAD'], { code: 'CHECKOUT_FAILED' })
  }
  // HEAD + version + built-entry assertions: ONE verifier, shared with the lane.
  const verified = verifyNextHostTree(tree, NEXT_HOST, { requireBuilt: false })

  // The tree pins its own package manager; it is READ, never typed here.
  let packageManager
  try {
    packageManager = JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8')).packageManager
  } catch (error) {
    throw new NextHostProvisionError('PACKAGE_UNREADABLE', `${join(tree, 'package.json')}: ${String(error?.message ?? error)}`)
  }
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(String(packageManager ?? ''))
  if (match === null) {
    throw new NextHostProvisionError('PNPM_UNPINNED', `${tree} declares packageManager=${JSON.stringify(packageManager ?? null)}, not an exact pnpm@x.y.z — an unpinned package manager is not a reproducible build`)
  }
  const pnpmVersion = match[1]

  mkdirSync(tools, { recursive: true })
  mkdirSync(store, { recursive: true })
  const sharedEnv = {
    npm_config_cache: join(tools, 'npm-cache'),
    npm_config_update_notifier: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    XDG_CACHE_HOME: join(tools, 'xdg-cache'),
    XDG_DATA_HOME: join(tools, 'xdg-data'),
  }
  run('npm', ['install', '--prefix', tools, '--no-save', '--no-audit', '--no-fund', `pnpm@${pnpmVersion}`], {
    env: sharedEnv,
    code: 'PNPM_INSTALL_FAILED',
  })
  const pnpmEntry = join(tools, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
  if (!existsSync(pnpmEntry)) {
    throw new NextHostProvisionError('PNPM_INSTALL_FAILED', `npm installed pnpm@${pnpmVersion} into ${tools} but ${pnpmEntry} is absent`)
  }

  run(process.execPath, [pnpmEntry, 'install', '--ignore-scripts', '--frozen-lockfile', '--store-dir', store], {
    cwd: tree,
    env: sharedEnv,
    code: 'INSTALL_FAILED',
  })
  run(process.execPath, [pnpmEntry, 'run', 'build'], {
    cwd: tree,
    env: {
      ...sharedEnv,
      DSH_CLIENT_COMMIT_HASH: NEXT_HOST.shortSha,
      ESBUILD_WORKER_THREADS: '1',
    },
    code: 'BUILD_FAILED',
  })

  // Re-assert AFTER the build: "it was pinned at clone time" is weaker than
  // "it is pinned now", and the lane is about to execute whatever is here.
  const after = verifyNextHostTree(tree, NEXT_HOST)
  const porcelain = capture('git', ['-C', tree, 'status', '--porcelain'])
  if (porcelain.status !== 0) {
    throw new NextHostProvisionError('PORCELAIN_UNREADABLE', `git -C ${tree} status --porcelain failed: ${porcelain.stderr}`)
  }
  const dirty = porcelain.stdout === '' ? 0 : porcelain.stdout.split('\n').length
  if (dirty !== 0) {
    throw new NextHostProvisionError('TREE_DIRTY', `${tree} is not clean after install+build (${String(dirty)} porcelain line(s)) — the build wrote TRACKED files, so the tree is no longer the pinned tree:\n${porcelain.stdout.split('\n').slice(0, 10).join('\n')}`)
  }
  console.log(`NEXT-HOST-MATERIALIZED tag=${NEXT_HOST.tag} head=${after.head} version=${after.version} pnpm=${pnpmVersion} tree=${tree}`)
  void verified
}

/** Provision the pinned published native assets for THIS host, then verify them. */
async function provisionAssets({ repoRoot, tree, receipt }) {
  verifyNextHostTree(tree, NEXT_HOST)
  let result
  try {
    result = await provisionHostSandboxAssetsFromPackage({
      runtimeTree: tree,
      repoRoot: TEAM_TREE,
      receiptPath: receipt,
      host: 'next',
    })
  } catch (error) {
    if (error instanceof HostSandboxAssetError) {
      throw new NextHostProvisionError(`ASSETS_${error.code}`, String(error.message))
    }
    throw error
  }
  verifyAssets({ repoRoot, tree })
  console.log([
    'NEXT-HOST-ASSETS',
    `package=${result.package.name}`,
    `version=${result.package.version}`,
    `tarballSha256=${result.package.tarballSha256}`,
    `distIntegrity=${result.package.distIntegrity}`,
    `files=${String(result.files.length)}`,
    `hostBaseline=${result.host.hostBaseline}`,
    `host=${result.host.sha}`,
    `manifestDigest=${result.manifest.digest}`,
    `utc=${result.at}`,
    `receipt=${result.receiptPath}`,
  ].join(' '))
}

/**
 * The asset pin of THIS host, re-derived from the committed manifest (never a
 * second copy of the digests), and verified against the bytes on disk. Shared by
 * `--assets` and `--verify` so the transport's own receipt and the lane's
 * precondition are the SAME comparison.
 */
function verifyAssets({ repoRoot, tree }) {
  const manifest = readHostSandboxAssetManifest({ repoRoot })
  const entry = manifestPlatformEntry(manifest, {
    version: NEXT_HOST.version,
    sha: NEXT_HOST.sha,
    platform: `${process.platform}-${process.arch}`,
    libc: detectedLibcVariant(),
  })
  const assets = verifyNextHostAssets({
    platformDir: join(tree, 'native', 'system', 'packages', `${process.platform}-${process.arch}`),
    files: entry.files,
    launcher: entry.launcher,
    tree,
  })
  return { assets, manifestDigest: manifestDigest(manifest) }
}

/** Assert tree + assets, with no network and no writes. */
function verify({ repoRoot, tree }) {
  const treeState = verifyNextHostTree(tree, NEXT_HOST)
  const { assets, manifestDigest: digest } = verifyAssets({ repoRoot, tree })
  console.log(`NEXT-HOST-VERIFIED head=${treeState.head} version=${treeState.version} assets=${assets.files.map((f) => `${f.relPath}:${f.sha256}:${String(f.bytes)}:${String(f.mode)}`).join('|')} manifestDigest=${digest}`)
}

try {
  if (flag('help') || flag('h')) {
    usage()
    process.exit(0)
  }
  const modes = ['materialize', 'assets', 'verify'].filter((m) => flag(m))
  if (modes.length !== 1) {
    throw new NextHostProvisionError('USAGE', `pass exactly one of --materialize, --assets, --verify (got ${JSON.stringify(modes)}); there is no default because each mode's failure message means something different`)
  }
  // Anchored at THIS checkout, not at the first ancestor carrying a legacy
  // test-use tree: `findTestRepoRoot` walks up, so from a task worktree it would
  // point at the main checkout and assert/provision a tree this lane never runs.
  const repoRoot = TEAM_TREE
  const tree = resolve(opt('tree') ?? nextHostTree(repoRoot))
  assertInsideWorkspace(repoRoot, tree)
  const work = join(repoRoot, '.artifacts', 'tmp', 'next-host')
  const store = resolve(opt('store-dir') ?? join(work, 'pnpm-store'))
  const tools = resolve(opt('tools-dir') ?? join(work, 'tools'))
  const receipt = opt('receipt') ?? join(repoRoot, '.artifacts', 'tmp', 'host-assets', 'next-provision-receipt.json')
  if (modes[0] === 'materialize') materialize({ tree, store, tools })
  else if (modes[0] === 'assets') await provisionAssets({ repoRoot, tree, receipt })
  else verify({ repoRoot, tree })
  process.exit(0)
} catch (error) {
  const code = error instanceof NextHostProvisionError
    ? error.code
    : error?.name === 'NextHostMissingError'
      ? String(error.code)
      : error instanceof HostSandboxAssetError
        ? `ASSETS_${error.code}`
        : 'UNEXPECTED'
  const detail = String(error?.message ?? error).replace(/\s+/gu, ' ').slice(0, 700)
  console.error(`NEXT-HOST-REFUSED code=${code} detail=${detail}`)
  process.exit(1)
}
